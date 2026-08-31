# cars/views.py - Complete fixed version

from .models import *
from .serializers import *
from datetime import timedelta, datetime
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.core.mail import send_mail
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
import cloudinary.uploader
import uuid
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse
import stripe
from django.db import models
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework.permissions import IsAdminUser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import check_password
import math
from datetime import date
import requests as http_requests


stripe.api_key = settings.STRIPE_SECRET_KEY


# ==================== HELPER FUNCTION FOR PAYMENT LEDGER ====================
def create_or_update_payment_ledger(rental, payment, payment_week_number):
    """Create or update Payment Ledger entry for driver weekly payments"""
    try:
        print(f"=== CREATE/UPDATE PAYMENT LEDGER ===")
        print(f"Rental: {rental.booking_reference}")
        print(f"Payment Week: {payment_week_number}")
        print(f"Payment Amount: {payment.amount if payment else 'No payment'}")
        
        # Get or create vehicle
        vehicle = None
        if rental.car:
            plate_number = f"CAR-{rental.car.id}"
            vehicle, created = Vehicle.objects.get_or_create(
                plate_number=plate_number,
                defaults={
                    'manufacturer': rental.car.brand,
                    'model': rental.car.name,
                    'year': rental.car.model_year,
                    'status': 'active'
                }
            )
            print(f"Vehicle: {vehicle.plate_number} (Created: {created})")
        
        if not vehicle:
            print("ERROR: No vehicle found!")
            return None
        
        # Calculate dates
        start_date = rental.start_date.date()
        week_start = start_date + timedelta(weeks=payment_week_number - 1)
        week_end = week_start + timedelta(days=6)
        due_date = week_start - timedelta(days=1)  # Due the day before week starts
        
        print(f"Week Start: {week_start}")
        print(f"Week End: {week_end}")
        print(f"Due Date: {due_date}")
        
        # Calculate due amount
        if payment and payment.amount:
            due_amount = float(payment.amount)
        else:
            # Try to get weekly price from rental
            if rental.weekly_price:
                due_amount = float(rental.weekly_price)
            elif rental.car and rental.car.weekly_price:
                due_amount = float(rental.car.weekly_price)
            else:
                due_amount = 0
        
        print(f"Due Amount: {due_amount}")
        
        # Check if ledger entry already exists
        ledger_entry, created = PaymentLedger.objects.get_or_create(
            plate_number=vehicle,
            driver_name=rental.customer_name,
            week_start=week_start,
            week_end=week_end,
            defaults={
                'due_date': due_date,
                'due_amount': due_amount,
                'status': 'paid' if payment and payment.status == 'completed' else 'pending',
                'received_amount': due_amount if payment and payment.status == 'completed' else 0,
                'received_date': date.today() if payment and payment.status == 'completed' else None,
            }
        )
        
        if not created and payment and payment.status == 'completed':
            ledger_entry.status = 'paid'
            ledger_entry.received_amount = due_amount
            ledger_entry.received_date = date.today()
            ledger_entry.save()
            print(f"Updated existing ledger entry to PAID")
        
        print(f"Payment Ledger Entry {'Created' if created else 'Updated'} - ID: {ledger_entry.id}")
        return ledger_entry
            
    except Exception as e:
        print(f"ERROR creating payment ledger: {e}")
        import traceback
        traceback.print_exc()
        return None

# ==================== HELPER FUNCTION FOR INCOME/EXPENSE ====================

def create_income_from_payment(payment):
    """Create IncomeExpense record from a completed payment"""
    try:
        rental = payment.rental
        vehicle = None
        
        if rental.car:
            plate_number = f"CAR-{rental.car.id}"
            vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
        
        if payment.payment_type == 'signup':
            category = 'rental'
            description = f"Signup fee - {rental.booking_reference} ({rental.customer_name})"
        elif payment.payment_type == 'bond':
            category = 'rental'
            description = f"Bond payment - {rental.booking_reference} ({rental.customer_name})"
        else:
            category = 'rental'
            description = f"Weekly payment #{payment.payment_for_week} - {rental.booking_reference} ({rental.customer_name})"
        
        payment_date = payment.payment_date.date() if payment.payment_date else date.today()
        
        existing = IncomeExpense.objects.filter(reference=payment.payment_reference).first()
        
        if existing:
            print(f"Income record already exists for payment {payment.payment_reference}")
            return existing
        
        income_record = IncomeExpense.objects.create(
            plate_number=vehicle,
            date=payment_date,
            type='income',
            category=category,
            amount=float(payment.amount),
            description=description,
            reference=payment.payment_reference
        )
        
        print(f"✅ Created income record: {income_record.id} - ${payment.amount}")
        return income_record
            
    except Exception as e:
        print(f"❌ Error creating income record: {e}")
        import traceback
        traceback.print_exc()
        return None

        
class EmptySerializer(serializers.Serializer):
    pass


@method_decorator(csrf_exempt, name='dispatch')
class AuthViewSet(viewsets.GenericViewSet):
    permission_classes = [AllowAny]
    serializer_class = EmptySerializer
    
    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'success': True,
                'message': 'User created successfully',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            request.session.save()
            
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'success': True,
                'message': 'Login successful',
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser,
                }
            })
        
        return Response({
            'success': False,
            'error': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    @action(detail=False, methods=['post'])
    def refresh_token(self, request):
        refresh_token = request.data.get('refresh_token')
        if not refresh_token:
            return Response({'error': 'Refresh token required'}, status=400)
        
        try:
            refresh = RefreshToken(refresh_token)
            return Response({
                'access_token': str(refresh.access_token),
            })
        except Exception as e:
            return Response({'error': 'Invalid refresh token'}, status=401)
    
    @action(detail=False, methods=['post'])
    def logout(self, request):
        logout(request)
        request.session.flush()
        return Response({'success': True, 'message': 'Logged out successfully'})
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        if request.user.is_authenticated:
            return Response({
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
                'is_staff': request.user.is_staff,
                'is_superuser': request.user.is_superuser,
            })
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            from rest_framework_simplejwt.tokens import AccessToken
            try:
                access_token = AccessToken(token)
                user_id = access_token['user_id']
                user = User.objects.get(id=user_id)
                return Response({
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_staff': user.is_staff,
                    'is_superuser': user.is_superuser,
                })
            except Exception as e:
                pass
        return Response({'error': 'Not authenticated'}, status=401)


@method_decorator(csrf_exempt, name='dispatch')
class CarViewSet(viewsets.ModelViewSet):
    queryset = Car.objects.all()
    serializer_class = CarSerializer

    def get_queryset(self):
        status_order = models.Case(
            models.When(status='booked_out', then=1),
            default=0,
            output_field=models.IntegerField(),
        )
        return Car.objects.annotate(status_order=status_order).order_by('status_order', '-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'add_image']:
            return [IsAuthenticated()]
        return [AllowAny()]
    
    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.save(owner=self.request.user)
        else:
            serializer.save()
    
    @action(detail=False, methods=['get'], url_path='my-cars')
    def my_cars(self, request):
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        status_order = models.Case(
            models.When(status='booked_out', then=1),
            default=0,
            output_field=models.IntegerField(),
        )
        cars = Car.objects.filter(owner=request.user).annotate(status_order=status_order).order_by('status_order', '-created_at')
        serializer = CarSerializer(cars, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def rent(self, request, pk=None):
        try:
            car = self.get_object()

            if car.status in ['booked_out', 'maintenance']:
                return Response(
                    {'error': f'This car is currently {car.get_status_display()} and cannot be booked.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            rental_type = request.data.get('rental_type', 'daily')
            customer_name = request.data.get('customer_name')
            customer_email = request.data.get('customer_email')
            customer_phone = request.data.get('customer_phone')
            start_date_str = request.data.get('start_date')
            end_date_str = request.data.get('end_date')
            days = request.data.get('days', 0)
            weeks = request.data.get('weeks', 0)
            months = request.data.get('months', 0)
            total_price = request.data.get('total_price', 0)
            weekly_price = request.data.get('weekly_price', 0)
            special_requests = request.data.get('special_requests', '')

            if not all([customer_name, customer_email, customer_phone, start_date_str]):
                return Response(
                    {'error': 'Missing required fields: name, email, phone, start_date'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                if 'Z' in start_date_str:
                    start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                else:
                    start_date = datetime.fromisoformat(start_date_str)
                
                if end_date_str:
                    if 'Z' in end_date_str:
                        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                    else:
                        end_date = datetime.fromisoformat(end_date_str)
                else:
                    end_date = None
            except Exception as e:
                return Response(
                    {'error': f'Invalid date format: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if rental_type == 'rent_to_own' and months > 0:
                if car.car_value and car.car_value > 0:
                    car_value = float(car.car_value)
                    years = int(months) / 12
                    
                    interest_rate = float(getattr(car, 'interest_rate', 0.095))
                    ongoing_cost_weekly = float(getattr(car, 'ongoing_cost_weekly', 79.00))
                    service_fee_weekly = float(getattr(car, 'service_fee_weekly', 55.00))
                    
                    total_weeks = int(math.ceil(years * 52.1775))
                    interest_total = car_value * interest_rate * years
                    ongoing_total = ongoing_cost_weekly * total_weeks
                    service_total = service_fee_weekly * total_weeks
                    
                    total_cost = car_value + interest_total + ongoing_total + service_total
                    calculated_weekly_price = round(total_cost / total_weeks, 2)
                    calculated_total = calculated_weekly_price * total_weeks
                else:
                    calculated_total = float(total_price) if total_price else 0
                    calculated_weekly_price = 0
            elif rental_type == 'weekly' and weeks > 0:
                if weekly_price > 0:
                    calculated_weekly_price = weekly_price
                else:
                    calculated_weekly_price = float(car.weekly_price)
                calculated_total = calculated_weekly_price * int(weeks)
            elif rental_type == 'daily' and days > 0:
                calculated_total = float(car.daily_price) * int(days)
                calculated_weekly_price = 0
            else:
                calculated_total = float(total_price) if total_price else 0
                calculated_weekly_price = 0
            
            from django.db import transaction
            
            with transaction.atomic():
                conflicting_bookings = Rental.objects.filter(
                    car=car,
                    status__in=['pending', 'confirmed', 'active'],
                    start_date__lt=end_date if end_date else start_date,
                    end_date__gt=start_date
                )
                
                overlapping_bookings = conflicting_bookings.count()
                available_units = car.total_units - overlapping_bookings
                
                if available_units <= 0:
                    return Response(
                        {
                            'error': f'No units available for selected dates.',
                            'available_units': 0,
                            'total_units': car.total_units,
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                rental = Rental.objects.create(
                    car=car,
                    rental_type=rental_type,
                    customer_name=customer_name,
                    customer_email=customer_email,
                    customer_phone=customer_phone,
                    start_date=start_date,
                    end_date=end_date,
                    days=int(days),
                    weeks=int(weeks),
                    months=int(months),
                    weekly_price=calculated_weekly_price,
                    total_price=calculated_total,
                    special_requests=special_requests,
                    status='pending'
                )
                
                return Response(
                    {
                        'success': True,
                        'message': 'Booking request submitted successfully!',
                        'booking_id': rental.id,
                        'booking_reference': rental.booking_reference,
                        'rental_type': rental_type,
                        'weeks': weeks,
                        'weekly_price': calculated_weekly_price,
                        'total_price': calculated_total,
                        'available_units_remaining': available_units - 1
                    },
                    status=status.HTTP_201_CREATED
                )
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
    @action(detail=True, methods=['post'])
    def add_image(self, request, pk=None):
        car = self.get_object()
        
        if 'image' not in request.FILES:
            return Response({'error': 'No image provided'}, status=400)
        
        image = request.FILES['image']
        
        is_primary = CarImage.objects.filter(car=car).count() == 0
        
        car_image = CarImage.objects.create(
            car=car,
            image=image,
            is_primary=is_primary
        )
        
        return Response({
            'success': True,
            'image_id': car_image.id,
            'image_url': car_image.image.url
        }, status=201)

    @action(detail=True, methods=['get'])
    def check_availability(self, request, pk=None):
        car = self.get_object()

        if car.status in ['booked_out', 'maintenance']:
            return Response({
                'is_available': False,
                'total_units': car.total_units,
                'available_units': 0,
                'status': car.status,
                'pending_bookings': Rental.objects.filter(car=car, status='pending').count()
            })

        total_active = Rental.objects.filter(
            car=car,
            status__in=['confirmed', 'active']
        ).count()

        available_units = max(0, min(car.available_units, car.total_units - total_active))

        return Response({
            'is_available': available_units > 0,
            'total_units': car.total_units,
            'available_units': available_units,
            'status': car.status,
            'pending_bookings': Rental.objects.filter(car=car, status='pending').count()
        })
    
    @action(detail=True, methods=['get'])
    def booked_date_ranges(self, request, pk=None):
        car = self.get_object()
        
        bookings = Rental.objects.filter(
            car=car,
            status__in=['confirmed', 'active']
        ).values('start_date', 'end_date')
        
        booked_ranges = []
        for booking in bookings:
            booked_ranges.append({
                'start': booking['start_date'].isoformat(),
                'end': booking['end_date'].isoformat() if booking['end_date'] else booking['start_date'].isoformat(),
            })
        
        return Response({
            'booked_ranges': booked_ranges,
            'total_units': car.total_units
        })

    @action(detail=True, methods=['post'])
    def upload_to_cloudinary(self, request, pk=None):
        car = self.get_object()
        
        if 'image' not in request.FILES:
            return Response({'error': 'No image provided'}, status=400)
        
        image = request.FILES['image']
        
        allowed_formats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'tiff']
        
        try:
            upload_result = cloudinary.uploader.upload(
                image,
                folder=f'ride-solutions/cars/{car.id}',
                allowed_formats=allowed_formats,
                resource_type='auto',
                format='jpg'
            )
            
            is_primary = CarImage.objects.filter(car=car).count() == 0
            car_image = CarImage.objects.create(
                car=car,
                image_url=upload_result['secure_url'],
                is_primary=is_primary,
                public_id=upload_result['public_id']
            )
            
            return Response({
                'success': True,
                'image_id': car_image.id,
                'image_url': upload_result['secure_url']
            }, status=201)
            
        except Exception as e:
            print(f"Cloudinary error: {str(e)}")
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def delete_image(self, request, pk=None):
        car = self.get_object()
        image_id = request.data.get('image_id')
        
        if not image_id:
            return Response({'error': 'image_id required'}, status=400)
        
        try:
            car_image = CarImage.objects.get(id=image_id, car=car)
            car_image.delete()
            return Response({'success': True, 'message': 'Image deleted'})
        except CarImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=404)

    @action(detail=True, methods=['post'])
    def create_checkout_session(self, request, pk=None):
        try:
            car = self.get_object()

            if car.status in ['booked_out', 'maintenance']:
                return Response({
                    'success': False,
                    'error': f'This car is currently {car.get_status_display()} and cannot be booked.'
                }, status=status.HTTP_400_BAD_REQUEST)

            rental_type = request.data.get('rental_type', 'daily')
            customer_name = request.data.get('customer_name')
            customer_email = request.data.get('customer_email')
            customer_phone = request.data.get('customer_phone')
            start_date_str = request.data.get('start_date')
            end_date_str = request.data.get('end_date')
            days = request.data.get('days', 0)
            weeks = request.data.get('weeks', 0)
            months = request.data.get('months', 0)
            total_price = request.data.get('total_price', 0)
            weekly_price = request.data.get('weekly_price', 0)
            special_requests = request.data.get('special_requests', '')
            signup_fee = request.data.get('signup_fee', 0)
            pay_signup_fee = request.data.get('pay_signup_fee', False)
            bond_amount = request.data.get('bond_amount', 0)
            pay_bond = request.data.get('pay_bond', False)
            
            if not all([customer_name, customer_email, customer_phone, start_date_str]):
                return Response({
                    'success': False,
                    'error': 'Missing required fields: name, email, phone, start_date'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            except:
                return Response({
                    'success': False,
                    'error': 'Invalid start date format'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            end_date = None
            calculated_total = 0
            calculated_weekly_price = 0
            initial_payment_amount = 0
            
            # FIXED: Correct valid RTO months - removed the typo "Quintal"
            valid_rto_months = [36, 48, 60, 72, 84]
            if rental_type == 'rent_to_own' and months > 0:
                if months not in valid_rto_months:
                    months = 36  # Default to 3 years
                
            if rental_type == 'weekly' and weeks > 0:
                if weekly_price > 0:
                    calculated_weekly_price = weekly_price
                else:
                    calculated_weekly_price = float(car.weekly_price)
                
                base_total = calculated_weekly_price * int(weeks)
                calculated_total = base_total
                
                if pay_signup_fee and float(signup_fee) > 0:
                    initial_payment_amount = float(signup_fee)
                else:
                    initial_payment_amount = calculated_weekly_price
                
                end_date = start_date + timedelta(weeks=int(weeks))
                
            elif rental_type == 'daily' and days > 0:
                base_total = float(car.daily_price) * int(days)
                calculated_total = base_total
                
                if pay_signup_fee and float(signup_fee) > 0:
                    initial_payment_amount = float(signup_fee)
                else:
                    initial_payment_amount = base_total
                
                calculated_weekly_price = 0
                end_date = start_date + timedelta(days=int(days))
                
            elif rental_type == 'rent_to_own' and months > 0:
                if car.car_value > 0:
                    car_value = float(car.car_value)
                    years = int(months) / 12
                    
                    interest_rate = float(getattr(car, 'interest_rate', 0.095))
                    ongoing_cost_weekly = float(getattr(car, 'ongoing_cost_weekly', 79.00))
                    service_fee_weekly = float(getattr(car, 'service_fee_weekly', 55.00))
                    
                    total_weeks = int(math.ceil(years * 52.1775))
                    interest_total = car_value * interest_rate * years
                    ongoing_total = ongoing_cost_weekly * total_weeks
                    service_total = service_fee_weekly * total_weeks
                    
                    total_cost = car_value + interest_total + ongoing_total + service_total
                    calculated_weekly_price = round(total_cost / total_weeks, 2)
                    calculated_total = calculated_weekly_price * total_weeks
                    
                    if pay_signup_fee and float(signup_fee) > 0:
                        initial_payment_amount = float(signup_fee)
                    else:
                        initial_payment_amount = calculated_weekly_price
                else:
                    calculated_total = float(total_price) if total_price else 0
                    calculated_weekly_price = 0
                    initial_payment_amount = calculated_total
                end_date = start_date + timedelta(days=int(months) * 30)
                
            elif end_date_str:
                try:
                    end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                except:
                    pass
                calculated_total = float(total_price) if total_price else 0
                initial_payment_amount = calculated_total
            
            # Check availability
            overlapping_bookings = Rental.objects.filter(
                car=car,
                status__in=['confirmed', 'active'],
                start_date__lt=end_date if end_date else start_date,
                end_date__gt=start_date
            ).count()
            
            available_units = car.total_units - overlapping_bookings
            
            if available_units <= 0:
                return Response({
                    'success': False,
                    'error': 'No units available for selected dates.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            booking_ref = f"RS-{uuid.uuid4().hex[:8].upper()}"
            
            # Create rental record
            rental = Rental.objects.create(
                car=car,
                rental_type=rental_type,
                customer_name=customer_name,
                customer_email=customer_email,
                customer_phone=customer_phone,
                start_date=start_date,
                end_date=end_date,
                days=int(days),
                weeks=int(weeks),
                months=int(months),
                weekly_price=calculated_weekly_price,
                total_price=calculated_total,
                special_requests=special_requests,
                status='pending',
                booking_reference=booking_ref,
                renter=request.user if request.user.is_authenticated else None,
                signup_fee_amount=float(signup_fee) if signup_fee else 0,
                signup_fee_paid=False,
                bond_amount=float(bond_amount) if bond_amount else 0,
                bond_paid=False,
            )
            
            # Create payment record for signup fee
            payment_ref = f"PMT-{uuid.uuid4().hex[:8].upper()}"
            payment_notes = f"Signup Fee - {rental_type} booking"
            
            payment = Payment.objects.create(
                rental=rental,
                amount=initial_payment_amount,
                payment_reference=payment_ref,
                payment_type='signup',
                status='pending',
                payment_for_week=0,
                notes=payment_notes
            )
            
            if not settings.STRIPE_SECRET_KEY:
                return Response({
                    'success': False,
                    'error': 'Payment system not configured'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            stripe.api_key = settings.STRIPE_SECRET_KEY
            
            # Build line items for Stripe
            line_items = []
            
            if pay_signup_fee and float(signup_fee) > 0:
                line_items.append({
                    'price_data': {
                        'currency': 'aud',
                        'unit_amount': int(round(float(signup_fee) * 100)),
                        'product_data': {
                            'name': f"Signup Fee - {car.brand} {car.name}",
                            'description': car.signup_fee_description or "Non-refundable booking fee to secure your reservation.",
                        },
                    },
                    'quantity': 1,
                })
            else:
                if rental_type == 'weekly':
                    rental_amount = calculated_weekly_price
                    product_name = f"{car.brand} {car.name} - Weekly Rental (First Week)"
                elif rental_type == 'daily':
                    rental_amount = base_total if 'base_total' in locals() else calculated_total
                    product_name = f"{car.brand} {car.name} - Daily Rental"
                else:
                    rental_amount = calculated_weekly_price
                    product_name = f"{car.brand} {car.name} - Rent to Own (First Week)"
                
                line_items.append({
                    'price_data': {
                        'currency': 'aud',
                        'unit_amount': int(round(float(rental_amount) * 100)),
                        'product_data': {
                            'name': product_name,
                            'description': f"First payment for {car.brand} {car.name}",
                        },
                    },
                    'quantity': 1,
                })
            
            print(f"=== CREATE CHECKOUT SESSION ===")
            print(f"Rental Type: {rental_type}")
            print(f"Signup Fee: ${signup_fee if pay_signup_fee else 0}")
            print(f"Initial Payment Amount: ${initial_payment_amount}")
            print(f"Line items count: {len(line_items)}")
            
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=line_items,
                mode='payment',
                success_url=f"{settings.FRONTEND_URL}/booking-success?session_id={{CHECKOUT_SESSION_ID}}&booking_ref={booking_ref}&payment_ref={payment_ref}",
                cancel_url=f"{settings.FRONTEND_URL}/car/{car.id}?canceled=true",
                customer_email=customer_email,
                metadata={
                    'car_id': str(car.id),
                    'rental_id': str(rental.id),
                    'booking_reference': booking_ref,
                    'payment_reference': payment_ref,
                    'payment_id': str(payment.id),
                    'customer_name': customer_name,
                    'customer_phone': customer_phone,
                    'is_first_payment': 'true',
                    'payment_type': 'signup',
                    'payment_for_week': '0',
                    'weeks': str(weeks),
                    'weekly_price': str(calculated_weekly_price),
                    'total_contract_value': str(calculated_total),
                    'initial_payment': str(initial_payment_amount),
                    'rental_type': rental_type,
                    'signup_fee': str(signup_fee if pay_signup_fee else 0),
                    'signup_fee_paid': str(pay_signup_fee),
                    'bond_amount': str(bond_amount),
                    'is_signup_only': str(pay_signup_fee and float(signup_fee) > 0),
                }
            )
            
            rental.stripe_session_id = checkout_session.id
            rental.save(update_fields=['stripe_session_id'])
            
            payment.stripe_session_id = checkout_session.id
            payment.save(update_fields=['stripe_session_id'])
            
            return Response({
                'success': True,
                'session_url': checkout_session.url,
                'booking_reference': booking_ref,
                'payment_reference': payment_ref,
                'initial_payment': initial_payment_amount,
                'weekly_price': calculated_weekly_price,
                'total_contract': calculated_total,
                'weeks': weeks,
                'signup_fee': signup_fee if pay_signup_fee else 0,
                'is_signup_only': pay_signup_fee and float(signup_fee) > 0,
            })
            
        except stripe.error.StripeError as e:
            print(f"Stripe error: {str(e)}")
            return Response({
                'success': False,
                'error': f'Payment error: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error creating checkout session: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


@csrf_exempt
@require_http_methods(["POST"])
def stripe_webhook(request):
    """Handle Stripe webhook events"""
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET
    
    if not webhook_secret:
        print("WARNING: STRIPE_WEBHOOK_SECRET not configured")
        return JsonResponse({'error': 'Webhook secret not configured'}, status=500)
    
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError as e:
        print(f"Invalid payload: {e}")
        return JsonResponse({'error': 'Invalid payload'}, status=400)
    except stripe.error.SignatureVerificationError as e:
        print(f"Invalid signature: {e}")
        return JsonResponse({'error': 'Invalid signature'}, status=400)
    
    print(f"Webhook received: {event['type']}")
    
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        booking_ref = session.get('metadata', {}).get('booking_reference')
        payment_ref = session.get('metadata', {}).get('payment_reference')
        payment_id = session.get('metadata', {}).get('payment_id')
        is_bond_payment = session.get('metadata', {}).get('is_bond_payment', 'false') == 'true'
        is_signup_payment = session.get('metadata', {}).get('is_signup_only', 'false') == 'true'
        payment_for_week = int(session.get('metadata', {}).get('payment_for_week', 0))
        
        print(f"Processing checkout session:")
        print(f"  Booking Ref: {booking_ref}")
        print(f"  Payment Ref: {payment_ref}")
        print(f"  Is Bond: {is_bond_payment}")
        print(f"  Is Signup: {is_signup_payment}")
        print(f"  Payment For Week: {payment_for_week}")
        
        if not booking_ref:
            print("ERROR: No booking_reference in metadata")
            return JsonResponse({'error': 'No booking reference'}, status=400)
        
        try:
            rental = Rental.objects.get(booking_reference=booking_ref)
            amount_paid = session.get('amount_total', 0) / 100
            stripe_payment_intent_id = session.get('payment_intent', '')
            stripe_session_id = session.get('id', '')
            
            print(f"Found rental: {rental.booking_reference}")
            print(f"Amount paid: ${amount_paid}")
            
            # Find existing payment or create new one
            payment = None
            
            if payment_id:
                try:
                    payment = Payment.objects.get(id=payment_id)
                    print(f"Found payment by ID: {payment.id}")
                except Payment.DoesNotExist:
                    pass
            
            if not payment and payment_ref:
                try:
                    payment = Payment.objects.get(payment_reference=payment_ref)
                    print(f"Found payment by reference: {payment.id}")
                except Payment.DoesNotExist:
                    pass
            
            # ==================== BOND PAYMENT ====================
            if is_bond_payment:
                print("Processing BOND payment...")
                
                # Update rental
                rental.bond_paid = True
                if rental.status == 'pending' or rental.status == 'confirmed':
                    rental.status = 'active'
                rental.save()
                print(f"Rental status updated to: {rental.status}")
                
                # Create or update payment record
                if not payment:
                    payment = Payment.objects.create(
                        rental=rental,
                        amount=amount_paid,
                        payment_reference=payment_ref or f"BOND-{uuid.uuid4().hex[:8].upper()}",
                        payment_type='bond',
                        status='completed',
                        payment_for_week=0,
                        notes="Bond payment completed",
                        stripe_session_id=stripe_session_id,
                        stripe_payment_intent_id=stripe_payment_intent_id
                    )
                    print(f"Created new bond payment record: {payment.payment_reference}")
                else:
                    payment.status = 'completed'
                    payment.stripe_payment_intent_id = stripe_payment_intent_id
                    payment.stripe_session_id = stripe_session_id
                    payment.amount = amount_paid
                    payment.save()
                    print(f"Updated bond payment record: {payment.payment_reference}")
                
                # ✅ CREATE INCOME RECORD FOR BOND
                print(f"🔍 Creating income record for bond payment: {payment.payment_reference}")
                try:
                    # Get vehicle
                    vehicle = None
                    if rental.car:
                        plate_number = f"CAR-{rental.car.id}"
                        vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
                    
                    # Create income record
                    income = IncomeExpense.objects.create(
                        plate_number=vehicle,
                        date=date.today(),
                        type='income',
                        category='rental',
                        amount=float(payment.amount),
                        description=f"Bond payment - {rental.booking_reference} ({rental.customer_name})",
                        reference=payment.payment_reference
                    )
                    print(f"✅ Created bond income record: ID {income.id}, Amount ${payment.amount}")
                except Exception as e:
                    print(f"❌ Error creating bond income record: {e}")
                    import traceback
                    traceback.print_exc()
                
                # Send email notification
                try:
                    send_mail(
                        subject=f"Bond Payment Received - {rental.booking_reference}",
                        message=f"""
Dear {rental.customer_name},

Your bond payment has been received!

Booking Reference: {rental.booking_reference}
Car: {rental.car.brand} {rental.car.name}
Bond Amount: ${amount_paid:,.2f}

Your booking is now active. Weekly payments will be charged as scheduled.

Thank you for choosing OTOBI GO!
""",
                        from_email=settings.EMAIL_HOST_USER,
                        recipient_list=[rental.customer_email],
                        fail_silently=True,
                    )
                except Exception as e:
                    print(f"Email error: {e}")
            
            # ==================== SIGNUP PAYMENT ====================
            elif is_signup_payment:
                print("Processing SIGNUP payment...")
                
                # Update rental
                rental.signup_fee_paid = True
                if rental.status == 'pending':
                    rental.status = 'confirmed'
                rental.save()
                print(f"Rental status updated to: {rental.status}")
                
                # Create or update payment record
                if not payment:
                    payment = Payment.objects.create(
                        rental=rental,
                        amount=amount_paid,
                        payment_reference=payment_ref or f"SIGNUP-{uuid.uuid4().hex[:8].upper()}",
                        payment_type='signup',
                        status='completed',
                        payment_for_week=0,
                        notes="Signup fee completed",
                        stripe_session_id=stripe_session_id,
                        stripe_payment_intent_id=stripe_payment_intent_id
                    )
                    print(f"Created new signup payment record: {payment.payment_reference}")
                else:
                    payment.status = 'completed'
                    payment.stripe_payment_intent_id = stripe_payment_intent_id
                    payment.stripe_session_id = stripe_session_id
                    payment.amount = amount_paid
                    payment.save()
                    print(f"Updated signup payment record: {payment.payment_reference}")
                
                # ✅ CREATE INCOME RECORD FOR SIGNUP
                print(f"🔍 Creating income record for signup payment: {payment.payment_reference}")
                try:
                    # Get vehicle
                    vehicle = None
                    if rental.car:
                        plate_number = f"CAR-{rental.car.id}"
                        vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
                    
                    # Create income record
                    income = IncomeExpense.objects.create(
                        plate_number=vehicle,
                        date=date.today(),
                        type='income',
                        category='rental',
                        amount=float(payment.amount),
                        description=f"Signup fee - {rental.booking_reference} ({rental.customer_name})",
                        reference=payment.payment_reference
                    )
                    print(f"✅ Created signup income record: ID {income.id}, Amount ${payment.amount}")
                except Exception as e:
                    print(f"❌ Error creating signup income record: {e}")
                    import traceback
                    traceback.print_exc()
                
                # ===== CREATE PAYMENT LEDGER ENTRIES FOR ALL WEEKS =====
                try:
                    # Get vehicle
                    vehicle = None
                    if rental.car:
                        plate_number = f"CAR-{rental.car.id}"
                        vehicle, vehicle_created = Vehicle.objects.get_or_create(
                            plate_number=plate_number,
                            defaults={
                                'manufacturer': rental.car.brand,
                                'model': rental.car.name,
                                'year': rental.car.model_year,
                                'status': 'active'
                            }
                        )
                        print(f"Vehicle: {vehicle.plate_number} (Created: {vehicle_created})")
                    
                    if vehicle:
                        # Calculate total weeks based on rental type
                        total_weeks = 0
                        if rental.rental_type == 'rent_to_own':
                            years = rental.months / 12 if rental.months else 3
                            total_weeks = int(math.ceil(years * 52.1775))
                        elif rental.rental_type == 'weekly':
                            total_weeks = rental.weeks or 0
                        else:
                            total_weeks = 1
                        
                        print(f"Total weeks to create: {total_weeks}")
                        
                        # Get weekly amount
                        weekly_amount = float(rental.weekly_price) if rental.weekly_price else 0
                        if weekly_amount == 0 and rental.car:
                            weekly_amount = float(rental.car.weekly_price)
                        
                        print(f"Weekly amount: ${weekly_amount}")
                        
                        # Create ledger entries for each week
                        start_date = rental.start_date.date()
                        created_count = 0
                        
                        for week_num in range(1, total_weeks + 1):
                            week_start = start_date + timedelta(weeks=week_num - 1)
                            week_end = week_start + timedelta(days=6)
                            due_date = week_start - timedelta(days=1)
                            
                            # Check if payment already exists for this week
                            existing_payment = Payment.objects.filter(
                                rental=rental,
                                payment_for_week=week_num,
                                status='completed'
                            ).first()
                            
                            is_paid = existing_payment is not None
                            
                            # Create or update ledger entry
                            ledger, created = PaymentLedger.objects.get_or_create(
                                plate_number=vehicle,
                                driver_name=rental.customer_name,
                                week_start=week_start,
                                week_end=week_end,
                                defaults={
                                    'due_date': due_date,
                                    'due_amount': weekly_amount,
                                    'status': 'paid' if is_paid else 'pending',
                                    'received_amount': weekly_amount if is_paid else 0,
                                    'received_date': date.today() if is_paid else None,
                                }
                            )
                            
                            if created:
                                created_count += 1
                                print(f"Created ledger entry for week {week_num}")
                            elif not is_paid and ledger.status == 'paid':
                                # Reset to pending if not actually paid
                                ledger.status = 'pending'
                                ledger.received_amount = 0
                                ledger.received_date = None
                                ledger.save()
                                print(f"Reset ledger entry for week {week_num} to pending")
                        
                        print(f"Created {created_count} payment ledger entries for rental {rental.booking_reference}")
                    
                except Exception as e:
                    print(f"Error creating payment ledger entries: {e}")
                    import traceback
                    traceback.print_exc()
                
                # Send email notification
                try:
                    bond_message = f'You now need to pay the bond amount (${rental.bond_amount}) to activate your booking.' if rental.bond_amount > 0 else 'Your first weekly payment will be due on your start date.'
                    
                    send_mail(
                        subject=f"Booking Confirmed - {rental.booking_reference}",
                        message=f"""
Dear {rental.customer_name},

Your booking has been confirmed!

Booking Reference: {rental.booking_reference}
Car: {rental.car.brand} {rental.car.name}
Rental Type: {rental.get_rental_type_display()}
Start Date: {rental.start_date}
Signup Fee Paid: ${amount_paid:,.2f}

What's next?
{bond_message}

Thank you for choosing OTOBI GO!
""",
                        from_email=settings.EMAIL_HOST_USER,
                        recipient_list=[rental.customer_email],
                        fail_silently=True,
                    )
                except Exception as e:
                    print(f"Email error: {e}")
            
            # ==================== WEEKLY PAYMENT ====================
            else:
                print(f"Processing WEEKLY payment for week {payment_for_week}...")
                
                # Get payment_for_week from metadata if not set
                if payment_for_week == 0:
                    payment_for_week = int(session.get('metadata', {}).get('payment_for_week', 1))
                
                # Create or update payment record
                if not payment:
                    payment = Payment.objects.create(
                        rental=rental,
                        amount=amount_paid,
                        payment_reference=payment_ref or f"PMT-{uuid.uuid4().hex[:8].upper()}",
                        payment_type=rental.rental_type,
                        status='completed',
                        payment_for_week=payment_for_week,
                        notes=f"Weekly payment - Week {payment_for_week}",
                        stripe_session_id=stripe_session_id,
                        stripe_payment_intent_id=stripe_payment_intent_id
                    )
                    print(f"Created new weekly payment record: {payment.payment_reference}")
                else:
                    payment.status = 'completed'
                    payment.payment_for_week = payment_for_week
                    payment.stripe_payment_intent_id = stripe_payment_intent_id
                    payment.stripe_session_id = stripe_session_id
                    payment.amount = amount_paid
                    payment.save()
                    print(f"Updated weekly payment record: {payment.payment_reference}")
                
                # ✅ CREATE INCOME RECORD FOR WEEKLY PAYMENT
                print(f"🔍 Creating income record for weekly payment: {payment.payment_reference}")
                try:
                    # Get vehicle
                    vehicle = None
                    if rental.car:
                        plate_number = f"CAR-{rental.car.id}"
                        vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
                    
                    # Create income record
                    income = IncomeExpense.objects.create(
                        plate_number=vehicle,
                        date=date.today(),
                        type='income',
                        category='rental',
                        amount=float(payment.amount),
                        description=f"Weekly payment #{payment_for_week} - {rental.booking_reference} ({rental.customer_name})",
                        reference=payment.payment_reference
                    )
                    print(f"✅ Created weekly income record: ID {income.id}, Amount ${payment.amount} for week {payment_for_week}")
                except Exception as e:
                    print(f"❌ Error creating weekly income record: {e}")
                    import traceback
                    traceback.print_exc()
                
                # Create or update Payment Ledger entry for this week
                try:
                    create_or_update_payment_ledger(rental, payment, payment_for_week)
                    print(f"Updated payment ledger for week {payment_for_week}")
                except Exception as e:
                    print(f"Error updating payment ledger: {e}")
                
                # Check if all payments are completed
                if rental.rental_type in ['weekly', 'rent_to_own']:
                    if rental.rental_type == 'rent_to_own':
                        years = rental.months / 12 if rental.months else 3
                        total_weeks = int(math.ceil(years * 52.1775))
                    else:
                        total_weeks = rental.weeks or 0
                    
                    completed_payments = Payment.objects.filter(
                        rental=rental, 
                        status='completed', 
                        payment_type__in=['weekly', 'daily', rental.rental_type]
                    ).count()
                    
                    print(f"Completed payments: {completed_payments} / {total_weeks}")
                    
                    if completed_payments >= total_weeks and total_weeks > 0:
                        rental.status = 'completed'
                        rental.save()
                        print(f"Rental marked as COMPLETED")
                    elif rental.status == 'confirmed' and completed_payments > 0:
                        rental.status = 'active'
                        rental.save()
                        print(f"Rental marked as ACTIVE")
                
                # Send email notification
                try:
                    completed_count = Payment.objects.filter(
                        rental=rental, 
                        status='completed', 
                        payment_type__in=['weekly', 'daily']
                    ).count()
                    
                    if rental.rental_type == 'rent_to_own':
                        years = rental.months / 12 if rental.months else 3
                        total_weeks = int(math.ceil(years * 52.1775))
                    else:
                        total_weeks = rental.weeks or 0
                    
                    remaining_balance = float(rental.total_price) - (float(payment.amount) * completed_count)
                    
                    send_mail(
                        subject=f"Payment Received - {rental.booking_reference}",
                        message=f"""
Dear {rental.customer_name},

Your payment has been received!

Booking Reference: {rental.booking_reference}
Car: {rental.car.brand} {rental.car.name}
Payment #{completed_count} of {total_weeks}
Amount Paid: ${amount_paid:,.2f}
Remaining Balance: ${remaining_balance:,.2f}

Thank you for your payment!
""",
                        from_email=settings.EMAIL_HOST_USER,
                        recipient_list=[rental.customer_email],
                        fail_silently=True,
                    )
                except Exception as e:
                    print(f"Email error: {e}")
            
            # Update car availability
            try:
                rental.car.update_status_based_on_bookings()
                print(f"Updated car availability for {rental.car.name}")
            except Exception as e:
                print(f"Error updating car availability: {e}")
            
            print(f"Successfully processed webhook for rental {rental.booking_reference}")
            
        except Rental.DoesNotExist:
            print(f"Rental not found for booking_ref: {booking_ref}")
            return JsonResponse({'error': 'Rental not found'}, status=404)
        except Exception as e:
            print(f"Webhook processing error: {e}")
            import traceback
            traceback.print_exc()
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'status': 'success'})

class ContactViewSet(viewsets.ModelViewSet):
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact = serializer.save()
        
        try:
            send_mail(
                subject=f"Contact Form: {contact.subject}",
                message=f"""
Name: {contact.name}
Email: {contact.email}
Subject: {contact.subject}
Message: {contact.message}
""",
                from_email=settings.EMAIL_HOST_USER,
                recipient_list=['Otobigo247@gmail.com'],
                fail_silently=False,
            )
            
            send_mail(
                subject="Thank you for contacting OTOBI GO",
                message=f"""
Dear {contact.name},

Thank you for contacting OTOBI GO. We have received your message and will get back to you within 24 hours.

Your message:
{contact.message}

Best regards,
OTOBI GO Team
""",
                from_email=settings.EMAIL_HOST_USER,
                recipient_list=[contact.email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Email error: {e}")
        
        return Response({'message': 'Message sent successfully!'}, status=201)


class RentalViewSet(viewsets.ModelViewSet):
    queryset = Rental.objects.all()
    serializer_class = RentalSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Rental.objects.filter(
            models.Q(renter=self.request.user) | 
            models.Q(customer_email=self.request.user.email)
        )
    
    def perform_create(self, serializer):
        serializer.save(renter=self.request.user if self.request.user.is_authenticated else None)
    
    def calculate_r2w_with_excel_formula(self, car, months):
        import math
        
        if not car or not car.car_value or car.car_value <= 0:
            return 0, 0, 0
        
        car_value = float(car.car_value)
        years = months / 12
        
        interest_rate = float(getattr(car, 'interest_rate', 0.095))
        ongoing_cost_weekly = float(getattr(car, 'ongoing_cost_weekly', 79.00))
        service_fee_weekly = float(getattr(car, 'service_fee_weekly', 55.00))
        
        total_weeks = int(math.ceil(years * 52.1775))
        interest_total = car_value * interest_rate * years
        ongoing_total = ongoing_cost_weekly * total_weeks
        service_total = service_fee_weekly * total_weeks
        
        total_cost = car_value + interest_total + ongoing_total + service_total
        weekly_payment = total_cost / total_weeks
        
        return round(weekly_payment, 2), total_weeks, round(total_cost, 2)

    @action(detail=False, methods=['get'])
    def my_rentals(self, request):
        rentals = self.get_queryset()
        serializer = self.get_serializer(rentals, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='user-bookings')
    def user_bookings(self, request):
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        bookings = Rental.objects.filter(
            Q(renter=request.user) | Q(customer_email=request.user.email)
        ).order_by('-created_at')
        
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='payment-history')
    def payment_history(self, request, pk=None):
        try:
            rental = self.get_object()
            
            if rental.renter != request.user and rental.customer_email != request.user.email:
                return Response({
                    'success': False,
                    'error': 'You are not authorized to view this booking'
                }, status=status.HTTP_403_FORBIDDEN)
            
            all_payments = Payment.objects.filter(rental=rental).order_by('payment_for_week')
            
            signup_payment = None
            bond_payment = None
            weekly_payments = []
            
            for payment in all_payments:
                if payment.payment_type == 'signup':
                    signup_payment = {
                        'id': payment.id,
                        'payment_reference': payment.payment_reference,
                        'amount': float(payment.amount),
                        'status': payment.status,
                        'payment_type': 'signup',
                        'payment_date': payment.payment_date,
                        'payment_for_week': 0,
                    }
                elif payment.payment_type == 'bond' or (payment.notes and 'bond' in payment.notes.lower()):
                    bond_payment = {
                        'id': payment.id,
                        'payment_reference': payment.payment_reference,
                        'amount': float(payment.amount),
                        'status': payment.status,
                        'payment_type': 'bond',
                        'payment_date': payment.payment_date,
                        'payment_for_week': 0,
                    }
                else:
                    weekly_payments.append({
                        'id': payment.id,
                        'payment_reference': payment.payment_reference,
                        'amount': float(payment.amount),
                        'status': payment.status,
                        'payment_type': payment.payment_type,
                        'payment_date': payment.payment_date,
                        'payment_for_week': payment.payment_for_week or (len([p for p in weekly_payments if p['status'] == 'completed']) + 1),
                    })
            
            completed_weekly_payments = [p for p in weekly_payments if p['status'] == 'completed']
            total_paid_weekly = sum(p['amount'] for p in completed_weekly_payments)
            signup_paid_amount = signup_payment['amount'] if signup_payment and signup_payment['status'] == 'completed' else 0
            bond_paid_amount = bond_payment['amount'] if bond_payment and bond_payment['status'] == 'completed' else 0
            total_paid = total_paid_weekly + signup_paid_amount + bond_paid_amount
            
            if rental.rental_type == 'rent_to_own':
                weekly_amount, total_weeks, total_due = self.calculate_r2w_with_excel_formula(
                    rental.car, 
                    rental.months or 36
                )
                total_due = total_due
                total_weeks = total_weeks
            else:
                total_due = float(rental.total_price)
                total_weeks = rental.weeks or 0
            
            remaining_balance = max(0, total_due - total_paid_weekly)
            remaining_weeks = max(0, total_weeks - len(completed_weekly_payments))
            next_week_number = len(completed_weekly_payments) + 1
            
            signup_required = rental.signup_fee_amount > 0
            signup_paid_status = signup_payment and signup_payment['status'] == 'completed'
            bond_required = rental.bond_amount > 0
            bond_paid_status = bond_payment and bond_payment['status'] == 'completed'
            
            requires_payment = remaining_balance > 0 and next_week_number <= total_weeks
            if signup_required and not signup_paid_status:
                requires_payment = False
            if bond_required and not bond_paid_status:
                requires_payment = False
            
            response_data = {
                'success': True,
                'payments': weekly_payments,
                'signup_payment': signup_payment,
                'bond_payment': bond_payment,
                'summary': {
                    'total_paid': total_paid,
                    'total_paid_weekly': total_paid_weekly,
                    'signup_paid': signup_paid_amount,
                    'bond_paid': bond_paid_amount,
                    'total_due': total_due,
                    'remaining_balance': remaining_balance,
                    'payment_count': len(completed_weekly_payments),
                    'rental_type': rental.rental_type,
                    'booking_reference': rental.booking_reference,
                    'car_name': f"{rental.car.brand} {rental.car.name}",
                    'rental_status': rental.status,
                    'remaining_weeks': remaining_weeks,
                    'next_week_number': next_week_number if next_week_number <= total_weeks else 0,
                    'total_weeks': total_weeks,
                    'requires_payment': requires_payment,
                    'signup_amount': float(rental.signup_fee_amount) if rental.signup_fee_amount else 0,
                    'signup_paid': signup_paid_status,
                    'signup_required': signup_required,
                    'bond_amount': float(rental.bond_amount) if rental.bond_amount else 0,
                    'bond_paid': bond_paid_status,
                    'bond_required': bond_required,
                }
            }
            
            return Response(response_data)
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='pay-bond')
    def pay_bond(self, request, pk=None):
        try:
            rental = Rental.objects.get(pk=pk)
            
            if not request.user.is_authenticated:
                return Response({
                    'success': False,
                    'error': 'Please login to make payment'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            if rental.renter != request.user and rental.customer_email != request.user.email:
                return Response({
                    'success': False,
                    'error': 'You are not authorized to make payment for this booking'
                }, status=status.HTTP_403_FORBIDDEN)
            
            if rental.bond_paid:
                return Response({
                    'success': False,
                    'error': 'Bond has already been paid'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            bond_amount = float(rental.bond_amount) if rental.bond_amount else 0
            if bond_amount <= 0:
                return Response({
                    'success': False,
                    'error': 'No bond is required for this booking'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            payment_ref = f"BOND-{uuid.uuid4().hex[:8].upper()}"
            
            payment = Payment.objects.create(
                rental=rental,
                amount=bond_amount,
                payment_reference=payment_ref,
                payment_type='bond',
                status='pending',
                payment_for_week=0,
                notes=f"Refundable bond payment for {rental.car.brand} {rental.car.name}"
            )
            
            stripe.api_key = settings.STRIPE_SECRET_KEY
            
            product_name = f"Refundable Bond - {rental.car.brand} {rental.car.name}"
            description = f"Refundable security bond for {rental.car.brand} {rental.car.name}. Fully refundable upon return of the vehicle in good condition."
            
            amount_in_cents = int(round(bond_amount * 100))
            
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'aud',
                        'unit_amount': amount_in_cents,
                        'product_data': {
                            'name': product_name,
                            'description': description,
                        },
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f"{settings.FRONTEND_URL}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&booking_ref={rental.booking_reference}&payment_ref={payment_ref}&type=bond",
                cancel_url=f"{settings.FRONTEND_URL}/my-bookings?canceled=true",
                customer_email=rental.customer_email,
                metadata={
                    'rental_id': str(rental.id),
                    'booking_reference': rental.booking_reference,
                    'payment_reference': payment_ref,
                    'payment_id': str(payment.id),
                    'payment_type': 'bond',
                    'amount': str(bond_amount),
                    'car_id': str(rental.car.id),
                    'is_bond_payment': 'true',
                }
            )
            
            payment.stripe_session_id = checkout_session.id
            payment.save(update_fields=['stripe_session_id'])
            
            return Response({
                'success': True,
                'session_url': checkout_session.url,
                'payment_reference': payment_ref,
                'amount': bond_amount,
            })
            
        except Exception as e:
            print(f"Bond payment error: {str(e)}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='make-payment')
    def make_payment(self, request, pk=None):
        try:
            rental = Rental.objects.get(pk=pk)
            
            if not request.user.is_authenticated:
                return Response({
                    'success': False,
                    'error': 'Please login to make payment'
                }, status=status.HTTP_401_UNAUTHORIZED)
            
            if rental.renter != request.user and rental.customer_email != request.user.email:
                return Response({
                    'success': False,
                    'error': 'You are not authorized to make payment for this booking'
                }, status=status.HTTP_403_FORBIDDEN)
            
            if rental.status == 'completed':
                return Response({
                    'success': False,
                    'error': 'This rental has already been completed'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if rental.status == 'cancelled':
                return Response({
                    'success': False,
                    'error': 'This rental has been cancelled'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            bond_required = rental.bond_amount > 0
            if bond_required and not rental.bond_paid:
                return Response({
                    'success': False,
                    'error': f'Please pay the bond first (${rental.bond_amount}) before making weekly payments',
                    'bond_required': True,
                    'bond_amount': rental.bond_amount
                }, status=status.HTTP_400_BAD_REQUEST)
            
            signup_required = rental.signup_fee_amount > 0
            if signup_required and not rental.signup_fee_paid:
                return Response({
                    'success': False,
                    'error': f'Please complete signup payment first (${rental.signup_fee_amount})',
                    'signup_required': True,
                    'signup_amount': rental.signup_fee_amount
                }, status=status.HTTP_400_BAD_REQUEST)
            
            completed_payments = Payment.objects.filter(
                rental=rental, 
                status='completed', 
                payment_type__in=['weekly', 'daily', rental.rental_type]
            )
            completed_payments_count = completed_payments.count()
            
            total_weeks = 0
            if rental.rental_type == 'rent_to_own':
                years = rental.months / 12 if rental.months else 3
                total_weeks = int(math.ceil(years * 52.1775))
            elif rental.rental_type == 'weekly':
                total_weeks = rental.weeks or 0
            else:
                total_weeks = 1
            
            if completed_payments_count >= total_weeks and total_weeks > 0:
                return Response({
                    'success': False,
                    'error': 'All payments have been completed'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            payment_for_week = completed_payments_count + 1
            
            amount = None
            
            if rental.weekly_price and float(rental.weekly_price) > 0:
                amount = float(rental.weekly_price)
            elif rental.car and rental.car.weekly_price and float(rental.car.weekly_price) > 0:
                amount = float(rental.car.weekly_price)
                rental.weekly_price = amount
                rental.save(update_fields=['weekly_price'])
            elif rental.rental_type == 'rent_to_own' and rental.car and rental.car.car_value and float(rental.car.car_value) > 0:
                months = rental.months or 36
                years = months / 12
                car_value = float(rental.car.car_value)
                
                interest_rate = float(getattr(rental.car, 'interest_rate', 0.095))
                ongoing_cost_weekly = float(getattr(rental.car, 'ongoing_cost_weekly', 79.00))
                service_fee_weekly = float(getattr(rental.car, 'service_fee_weekly', 55.00))
                
                total_weeks_calc = int(math.ceil(years * 52.1775))
                interest_total = car_value * interest_rate * years
                ongoing_total = ongoing_cost_weekly * total_weeks_calc
                service_total = service_fee_weekly * total_weeks_calc
                
                total_cost = car_value + interest_total + ongoing_total + service_total
                amount = round(total_cost / total_weeks_calc, 2)
                rental.weekly_price = amount
                rental.save(update_fields=['weekly_price'])
            elif rental.total_price and float(rental.total_price) > 0 and total_weeks > 0:
                amount = float(rental.total_price) / total_weeks
            else:
                any_payment = Payment.objects.filter(rental=rental, status='completed').first()
                if any_payment and float(any_payment.amount) > 0:
                    amount = float(any_payment.amount)
                else:
                    pending_payment = Payment.objects.filter(rental=rental, status='pending').first()
                    if pending_payment and float(pending_payment.amount) > 0:
                        amount = float(pending_payment.amount)
                    else:
                        return Response({
                            'success': False,
                            'error': f'Cannot determine payment amount. Please contact support.'
                        }, status=status.HTTP_400_BAD_REQUEST)
            
            if not amount or amount <= 0:
                return Response({
                    'success': False,
                    'error': f'Invalid payment amount: ${amount}. Please contact support.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            amount = round(amount, 2)
            
            payment_ref = f"PAY-{uuid.uuid4().hex[:8].upper()}"
            
            payment = Payment.objects.create(
                rental=rental,
                amount=amount,
                payment_reference=payment_ref,
                payment_type=rental.rental_type,
                status='pending',
                payment_for_week=payment_for_week,
                notes=f"Weekly payment #{payment_for_week} for {rental.car.brand} {rental.car.name}"
            )
            
            stripe.api_key = settings.STRIPE_SECRET_KEY
            
            description = f"Weekly payment {payment_for_week} of {total_weeks} for {rental.car.brand} {rental.car.name}"
            product_name = f"{rental.car.brand} {rental.car.name} - Weekly Payment #{payment_for_week}"
            amount_in_cents = int(round(amount * 100))
            
            if amount_in_cents < 50:
                amount_in_cents = 50
                amount = 0.50
            
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'aud',
                        'unit_amount': amount_in_cents,
                        'product_data': {
                            'name': product_name,
                            'description': description,
                        },
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f"{settings.FRONTEND_URL}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&booking_ref={rental.booking_reference}&payment_ref={payment_ref}",
                cancel_url=f"{settings.FRONTEND_URL}/my-bookings?canceled=true",
                customer_email=rental.customer_email,
                metadata={
                    'rental_id': str(rental.id),
                    'booking_reference': rental.booking_reference,
                    'payment_reference': payment_ref,
                    'payment_id': str(payment.id),
                    'payment_type': rental.rental_type,
                    'amount': str(amount),
                    'payment_for_week': str(payment_for_week),
                    'total_weeks': str(total_weeks),
                    'car_id': str(rental.car.id) if rental.car else '',
                    'is_first_payment': str(completed_payments_count == 0),
                    'weekly_amount': str(amount),
                }
            )
            
            payment.stripe_session_id = checkout_session.id
            payment.save(update_fields=['stripe_session_id'])
            
            return Response({
                'success': True,
                'session_url': checkout_session.url,
                'payment_reference': payment_ref,
                'amount': amount,
                'payment_for_week': payment_for_week,
                'total_weeks': total_weeks,
                'remaining_payments': max(0, total_weeks - payment_for_week)
            })
                
        except Rental.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Rental not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Payment error: {str(e)}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class AdminDashboardViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAdminUser]
    queryset = User.objects.none()
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        today = date.today()
        first_day_of_month = today.replace(day=1)
        
        total_vehicles = Vehicle.objects.count()
        active_vehicles = Vehicle.objects.filter(status='active').count()
        expiring_registrations = Vehicle.objects.filter(
            registration_expiry__gte=today,
            registration_expiry__lte=today + timedelta(days=30)
        ).count()
        
        active_drivers = Driver.objects.filter(is_current=True).count()
        total_drivers = Driver.objects.count()
        
        pending_payments = PaymentLedger.objects.filter(status='pending').count()
        overdue_payments = PaymentLedger.objects.filter(
            status='pending', 
            due_date__lt=today
        ).count()
        total_due = PaymentLedger.objects.filter(status='pending').aggregate(
            total=Sum('due_amount')
        )['total'] or 0
        
        expiring_insurances = Insurance.objects.filter(
            status='active',
            end_date__gte=today,
            end_date__lte=today + timedelta(days=30)
        ).count()
        
        services_due = ServiceRecord.objects.filter(
            current_reading__gte=models.F('next_service_at')
        ).count()
        services_due_soon = ServiceRecord.objects.filter(
            next_service_at__gt=models.F('current_reading'),
            next_service_at__lte=models.F('current_reading') + 5000
        ).count()
        
        outstanding_offences = TollOffence.objects.filter(status='outstanding').count()
        overdue_offences = TollOffence.objects.filter(
            status='outstanding',
            maturity_date__lt=today
        ).count()
        
        monthly_income = IncomeExpense.objects.filter(
            type='income',
            date__gte=first_day_of_month,
            date__lte=today
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        monthly_expenses = IncomeExpense.objects.filter(
            type='expense',
            date__gte=first_day_of_month,
            date__lte=today
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        net_profit = monthly_income - monthly_expenses
        
        total_cars = Car.objects.count()
        available_cars = Car.objects.filter(status='available').count()
        rented_cars = Car.objects.filter(status='rented').count()
        
        return Response({
            'total_vehicles': total_vehicles,
            'active_vehicles': active_vehicles,
            'expiring_registrations': expiring_registrations,
            'active_drivers': active_drivers,
            'total_drivers': total_drivers,
            'pending_payments': pending_payments,
            'overdue_payments': overdue_payments,
            'total_due': total_due,
            'expiring_insurances': expiring_insurances,
            'services_due': services_due,
            'services_due_soon': services_due_soon,
            'outstanding_offences': outstanding_offences,
            'overdue_offences': overdue_offences,
            'monthly_income': monthly_income,
            'monthly_expenses': monthly_expenses,
            'net_profit': net_profit,
            'total_cars': total_cars,
            'available_cars': available_cars,
            'rented_cars': rented_cars,
        })
    
    @action(detail=True, methods=['delete'], url_path='rental-cascade')
    def delete_rental_cascade(self, request, pk=None):
        """Delete rental and all related records (payments, income, ledger)"""
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        try:
            rental = Rental.objects.get(pk=pk)
            booking_ref = rental.booking_reference
            
            payments = Payment.objects.filter(rental=rental)
            payment_count = payments.count()
            
            for payment in payments:
                IncomeExpense.objects.filter(reference=payment.payment_reference).delete()
            
            vehicle = None
            if rental.car:
                plate_number = f"CAR-{rental.car.id}"
                vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
            
            if vehicle:
                PaymentLedger.objects.filter(
                    plate_number=vehicle,
                    driver_name=rental.customer_name
                ).delete()
            
            payments.delete()
            rental.delete()
            
            if rental.car:
                rental.car.update_status_based_on_bookings()
            
            return Response({
                'success': True,
                'message': f'Rental {booking_ref} and {payment_count} payment(s) deleted successfully',
                'deleted_payments': payment_count
            })
            
        except Rental.DoesNotExist:
            return Response({'error': 'Rental not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    @action(detail=False, methods=['get'], url_path='all-cars')
    def all_cars(self, request):
        cars = Car.objects.all().order_by('-created_at')
        serializer = CarSerializer(cars, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='cars')
    def create_car_admin(self, request):
        serializer = CarSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            car = serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['put', 'patch'], url_path='car')
    def update_car_admin(self, request, pk=None):
        try:
            car = Car.objects.get(pk=pk)
        except Car.DoesNotExist:
            return Response({'error': 'Car not found'}, status=404)
        
        serializer = CarSerializer(car, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['delete'], url_path='car')
    def delete_car_admin(self, request, pk=None):
        try:
            car = Car.objects.get(pk=pk)
            car.delete()
            return Response({'success': True, 'message': 'Car deleted successfully'})
        except Car.DoesNotExist:
            return Response({'error': 'Car not found'}, status=404)
    
    @action(detail=False, methods=['get'], url_path='all-rentals')
    def all_rentals(self, request):
        rentals = Rental.objects.all().order_by('-created_at')
        serializer = RentalSerializer(rentals, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['patch'], url_path='rental-status')
    def update_rental_status(self, request, pk=None):
        try:
            rental = Rental.objects.get(pk=pk)
            new_status = request.data.get('status')
            if new_status:
                rental.status = new_status
                rental.save()
                return Response({'success': True, 'status': rental.status})
            return Response({'error': 'Status required'}, status=400)
        except Rental.DoesNotExist:
            return Response({'error': 'Rental not found'}, status=404)
    
    @action(detail=False, methods=['post'], url_path='sync-cars-to-vehicles')
    def sync_cars_to_vehicles(self, request):
        try:
            cars = Car.objects.all()
            created_count = 0
            updated_count = 0
            errors = []
            
            for car in cars:
                try:
                    plate_number = f"CAR-{car.id}"
                    
                    vehicle, created = Vehicle.objects.get_or_create(
                        plate_number=plate_number,
                        defaults={
                            'manufacturer': car.brand or '',
                            'model': car.name or '',
                            'year': car.model_year or None,
                            'status': 'active',
                            'purchase_price': float(car.car_value) if car.car_value else 0,
                            'colour': '',
                            'vin_number': '',
                            'engine_number': '',
                        }
                    )
                    
                    if created:
                        created_count += 1
                    else:
                        vehicle.manufacturer = car.brand or vehicle.manufacturer
                        vehicle.model = car.name or vehicle.model
                        vehicle.year = car.model_year or vehicle.year
                        vehicle.purchase_price = float(car.car_value) if car.car_value else vehicle.purchase_price
                        vehicle.save()
                        updated_count += 1
                    
                    if car.status == 'available':
                        vehicle.status = 'active'
                    elif car.status == 'rented':
                        vehicle.status = 'rented'
                    elif car.status == 'maintenance':
                        vehicle.status = 'maintenance'
                    vehicle.save()
                    
                except Exception as e:
                    errors.append(f"Car {car.id} ({car.name}): {str(e)}")
            
            return Response({
                'success': True,
                'message': f'Synced {created_count} new vehicles, updated {updated_count} existing vehicles',
                'created': created_count,
                'updated': updated_count,
                'total': cars.count(),
                'errors': errors
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'], url_path='all-vehicles-with-cars')
    def all_vehicles_with_cars(self, request):
        try:
            vehicles = Vehicle.objects.all().order_by('-id')
            cars = Car.objects.all()
            car_map = {car.id: car for car in cars}
            
            vehicle_data = []
            for vehicle in vehicles:
                associated_car = None
                if vehicle.plate_number and vehicle.plate_number.startswith('CAR-'):
                    try:
                        car_id = int(vehicle.plate_number.split('-')[1])
                        associated_car = car_map.get(car_id)
                    except:
                        pass
                
                vehicle_data.append({
                    'id': vehicle.id,
                    'plate_number': vehicle.plate_number,
                    'manufacturer': vehicle.manufacturer,
                    'model': vehicle.model,
                    'year': vehicle.year,
                    'colour': vehicle.colour,
                    'vin_number': vehicle.vin_number,
                    'engine_number': vehicle.engine_number,
                    'registration_date': vehicle.registration_date,
                    'registration_expiry': vehicle.registration_expiry,
                    'seller': vehicle.seller,
                    'purchase_price': vehicle.purchase_price,
                    'purchase_date': vehicle.purchase_date,
                    'status': vehicle.status,
                    'is_from_car': vehicle.plate_number and vehicle.plate_number.startswith('CAR-'),
                    'associated_car': {
                        'id': associated_car.id if associated_car else None,
                        'name': associated_car.name if associated_car else None,
                        'brand': associated_car.brand if associated_car else None,
                        'daily_price': associated_car.daily_price if associated_car else None,
                        'weekly_price': associated_car.weekly_price if associated_car else None,
                    } if associated_car else None
                })
            
            return Response(vehicle_data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'], url_path='all-vehicles')
    def all_vehicles(self, request):
        vehicles = Vehicle.objects.all().order_by('-id')
        serializer = VehicleSerializer(vehicles, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='vehicles')
    def create_vehicle_admin(self, request):
        serializer = VehicleSerializer(data=request.data)
        if serializer.is_valid():
            vehicle = serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['put', 'patch'], url_path='vehicle')
    def update_vehicle_full(self, request, pk=None):
        try:
            vehicle = Vehicle.objects.get(pk=pk)
        except Vehicle.DoesNotExist:
            return Response({'error': 'Vehicle not found'}, status=404)
        
        serializer = VehicleSerializer(vehicle, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['delete'], url_path='vehicle')
    def delete_vehicle(self, request, pk=None):
        try:
            vehicle = Vehicle.objects.get(pk=pk)
            vehicle.delete()
            return Response({'success': True, 'message': 'Vehicle deleted successfully'})
        except Vehicle.DoesNotExist:
            return Response({'error': 'Vehicle not found'}, status=404)
    
    @action(detail=False, methods=['get'], url_path='all-drivers-with-rentals')
    def all_drivers_with_rentals(self, request):
        try:
            drivers = Driver.objects.all().order_by('-id')
            rentals = Rental.objects.all().order_by('-created_at')
            
            driver_rentals = {}
            for rental in rentals:
                driver = None
                if rental.customer_email:
                    driver = drivers.filter(email_address=rental.customer_email).first()
                if not driver and rental.customer_phone:
                    driver = drivers.filter(phone_number=rental.customer_phone).first()
                
                if driver:
                    if driver.id not in driver_rentals:
                        driver_rentals[driver.id] = []
                    driver_rentals[driver.id].append({
                        'id': rental.id,
                        'booking_reference': rental.booking_reference,
                        'car_name': rental.car.name if rental.car else 'N/A',
                        'car_brand': rental.car.brand if rental.car else 'N/A',
                        'rental_type': rental.rental_type,
                        'start_date': rental.start_date,
                        'end_date': rental.end_date,
                        'status': rental.status,
                        'total_price': rental.total_price,
                        'weekly_price': rental.weekly_price,
                        'signup_fee_paid': rental.signup_fee_paid,
                        'signup_fee_amount': rental.signup_fee_amount,
                        'bond_paid': rental.bond_paid,
                        'bond_amount': rental.bond_amount,
                        'created_at': rental.created_at
                    })
            
            driver_data = []
            for driver in drivers:
                driver_data.append({
                    'id': driver.id,
                    'name': driver.name,
                    'phone_number': driver.phone_number,
                    'email_address': driver.email_address,
                    'driver_licence_no': driver.driver_licence_no,
                    'date_of_birth': driver.date_of_birth,
                    'address': driver.address,
                    'start_date': driver.start_date,
                    'end_date': driver.end_date,
                    'is_current': driver.is_current,
                    'plate_number': driver.plate_number.plate_number if driver.plate_number else None,
                    'vehicle_plate': driver.plate_number.plate_number if driver.plate_number else None,
                    'rentals': driver_rentals.get(driver.id, []),
                    'total_bookings': len(driver_rentals.get(driver.id, [])),
                    'total_spent': sum(float(r['total_price']) for r in driver_rentals.get(driver.id, [])),
                    'has_active_rental': any(r['status'] == 'active' for r in driver_rentals.get(driver.id, []))
                })
            
            return Response(driver_data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='drivers')
    def create_driver_admin(self, request):
        serializer = DriverSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['put', 'patch'], url_path='driver')
    def update_driver_full(self, request, pk=None):
        try:
            driver = Driver.objects.get(pk=pk)
        except Driver.DoesNotExist:
            return Response({'error': 'Driver not found'}, status=404)
        
        serializer = DriverSerializer(driver, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['delete'], url_path='driver')
    def delete_driver(self, request, pk=None):
        try:
            driver = Driver.objects.get(pk=pk)
            driver.delete()
            return Response({'success': True, 'message': 'Driver deleted successfully'})
        except Driver.DoesNotExist:
            return Response({'error': 'Driver not found'}, status=404)
    

    @action(detail=False, methods=['post'], url_path='fix-payment-ledger')
    def fix_payment_ledger(self, request):
        """Manually create missing payment ledger entries for all rentals"""
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        try:
            created_count = 0
            updated_count = 0
            errors = []
            
            # Get all active and confirmed rentals
            rentals = Rental.objects.filter(
                status__in=['confirmed', 'active', 'pending']
            ).exclude(status='cancelled')
            
            print(f"Processing {rentals.count()} rentals...")
            
            for rental in rentals:
                try:
                    # Skip if signup not paid
                    if rental.signup_fee_amount > 0 and not rental.signup_fee_paid:
                        print(f"Skipping rental {rental.booking_reference} - signup not paid")
                        continue
                    
                    # Get vehicle
                    if not rental.car:
                        print(f"Skipping rental {rental.booking_reference} - no car")
                        continue
                    
                    plate_number = f"CAR-{rental.car.id}"
                    vehicle, _ = Vehicle.objects.get_or_create(
                        plate_number=plate_number,
                        defaults={
                            'manufacturer': rental.car.brand,
                            'model': rental.car.name,
                            'year': rental.car.model_year,
                            'status': 'active'
                        }
                    )
                    
                    # Calculate total weeks
                    total_weeks = 0
                    if rental.rental_type == 'rent_to_own':
                        years = rental.months / 12 if rental.months else 3
                        total_weeks = int(math.ceil(years * 52.1775))
                    elif rental.rental_type == 'weekly':
                        total_weeks = rental.weeks or 0
                    else:
                        total_weeks = 1
                    
                    # Get completed payments
                    completed_payments = Payment.objects.filter(
                        rental=rental,
                        status='completed',
                        payment_type__in=['weekly', 'daily', rental.rental_type]
                    )
                    
                    # Create ledger entries for each week
                    start_date = rental.start_date.date()
                    
                    for week_num in range(1, total_weeks + 1):
                        week_start = start_date + timedelta(weeks=week_num - 1)
                        week_end = week_start + timedelta(days=6)
                        due_date = week_start - timedelta(days=1)
                        
                        # Check if payment completed for this week
                        payment_for_week = completed_payments.filter(payment_for_week=week_num).first()
                        is_paid = payment_for_week is not None
                        
                        # Get weekly amount
                        if rental.weekly_price:
                            weekly_amount = float(rental.weekly_price)
                        elif rental.car and rental.car.weekly_price:
                            weekly_amount = float(rental.car.weekly_price)
                        else:
                            weekly_amount = 0
                        
                        # Create or update ledger entry
                        ledger, created = PaymentLedger.objects.get_or_create(
                            plate_number=vehicle,
                            driver_name=rental.customer_name,
                            week_start=week_start,
                            week_end=week_end,
                            defaults={
                                'due_date': due_date,
                                'due_amount': weekly_amount,
                                'status': 'paid' if is_paid else 'pending',
                                'received_amount': weekly_amount if is_paid else 0,
                                'received_date': date.today() if is_paid else None,
                            }
                        )
                        
                        if not created and is_paid and ledger.status != 'paid':
                            ledger.status = 'paid'
                            ledger.received_amount = weekly_amount
                            ledger.received_date = date.today()
                            ledger.save()
                            updated_count += 1
                        elif created:
                            created_count += 1
                    
                    print(f"Processed rental {rental.booking_reference} - {total_weeks} weeks")
                    
                except Exception as e:
                    errors.append(f"Rental {rental.id} ({rental.booking_reference}): {str(e)}")
                    print(f"Error processing rental {rental.id}: {e}")
            
            return Response({
                'success': True,
                'message': f'Created {created_count} ledger entries, updated {updated_count} entries',
                'created': created_count,
                'updated': updated_count,
                'rentals_processed': rentals.count(),
                'errors': errors
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)


    @action(detail=False, methods=['post'], url_path='sync-payment-ledger')
    def sync_payment_ledger(self, request):
        try:
            completed_payments = Payment.objects.filter(status='completed')
            
            created_count = 0
            errors = []
            
            for payment in completed_payments:
                try:
                    rental = payment.rental
                    payment_for_week = payment.payment_for_week
                    
                    if payment_for_week == 0:
                        continue
                    
                    create_or_update_payment_ledger(rental, payment, payment_for_week)
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"Payment {payment.id}: {str(e)}")
            
            return Response({
                'success': True,
                'message': f'Synced {created_count} completed payments',
                'completed_synced': created_count,
                'errors': errors
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'], url_path='all-payment-ledger')
    def all_payment_ledger(self, request):
        try:
            payments = PaymentLedger.objects.all().select_related('plate_number').order_by('-due_date')
            serializer = PaymentLedgerSerializer(payments, many=True)
            data = serializer.data
            for payment in data:
                payment['is_late'] = False
                if payment.get('due_date') and payment.get('status') != 'paid':
                    due_date = datetime.strptime(payment['due_date'], '%Y-%m-%d').date()
                    if due_date < date.today():
                        payment['is_late'] = True
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='payment-ledger')
    def create_payment_ledger_admin(self, request):
        serializer = PaymentLedgerSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=['patch'], url_path='payment-ledger')
    def update_payment_ledger(self, request, pk=None):
        try:
            payment = PaymentLedger.objects.get(pk=pk)
            
            status = request.data.get('status')
            received_date = request.data.get('received_date')
            received_amount = request.data.get('received_amount')
            
            if status:
                payment.status = status
            if received_date:
                payment.received_date = received_date
            if received_amount:
                payment.received_amount = float(received_amount)
                if payment.received_amount >= payment.due_amount:
                    payment.status = 'paid'
            
            payment.save()
            
            if payment.status == 'paid' and payment.received_amount > 0:
                IncomeExpense.objects.get_or_create(
                    plate_number=payment.plate_number,
                    date=payment.received_date or date.today(),
                    type='income',
                    category='rental',
                    amount=payment.received_amount,
                    description=f"Weekly payment - {payment.driver_name}",
                    reference=f"LEDGER-{payment.id}"
                )
            
            serializer = PaymentLedgerSerializer(payment)
            return Response(serializer.data)
        except PaymentLedger.DoesNotExist:
            return Response({'error': 'Payment record not found'}, status=404)

    @action(detail=True, methods=['delete'], url_path='payment-ledger')
    def delete_payment_ledger(self, request, pk=None):
        try:
            payment = PaymentLedger.objects.get(pk=pk)
            payment.delete()
            return Response({'success': True, 'message': 'Payment record deleted successfully'})
        except PaymentLedger.DoesNotExist:
            return Response({'error': 'Payment record not found'}, status=404)

    @action(detail=False, methods=['get'], url_path='upcoming-payments')
    def upcoming_payments(self, request):
        try:
            today = date.today()
            
            active_rentals = Rental.objects.filter(
                status__in=['confirmed', 'active']
            ).select_related('car')
            
            upcoming_payments = []
            
            for rental in active_rentals:
                if rental.signup_fee_amount > 0 and not rental.signup_fee_paid:
                    continue
                
                if rental.bond_amount > 0 and not rental.bond_paid:
                    continue
                
                total_weeks = 0
                if rental.rental_type == 'rent_to_own':
                    years = rental.months / 12 if rental.months else 3
                    total_weeks = int(math.ceil(years * 52.1775))
                elif rental.rental_type == 'weekly':
                    total_weeks = rental.weeks or 0
                else:
                    total_weeks = 1
                
                completed_payments = Payment.objects.filter(
                    rental=rental, 
                    status='completed',
                    payment_type__in=['weekly', 'daily', rental.rental_type]
                ).count()
                
                if completed_payments >= total_weeks:
                    continue
                
                next_week_number = completed_payments + 1
                start_date = rental.start_date.date()
                next_payment_date = start_date + timedelta(weeks=next_week_number - 1)
                
                weekly_amount = float(rental.weekly_price) if rental.weekly_price else 0
                if weekly_amount == 0 and rental.car:
                    weekly_amount = float(rental.car.weekly_price)
                
                vehicle = None
                if rental.car:
                    plate_number = f"CAR-{rental.car.id}"
                    vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
                
                upcoming_payments.append({
                    'id': rental.id,
                    'booking_reference': rental.booking_reference,
                    'customer_name': rental.customer_name,
                    'customer_email': rental.customer_email,
                    'customer_phone': rental.customer_phone,
                    'car_name': rental.car.name if rental.car else 'N/A',
                    'car_brand': rental.car.brand if rental.car else 'N/A',
                    'plate_number': vehicle.plate_number if vehicle else None,
                    'weekly_amount': weekly_amount,
                    'next_week_number': next_week_number,
                    'total_weeks': total_weeks,
                    'next_payment_date': next_payment_date,
                    'completed_payments': completed_payments,
                    'remaining_payments': total_weeks - completed_payments,
                    'rental_status': rental.status,
                    'rental_type': rental.rental_type,
                    'signup_paid': rental.signup_fee_paid,
                    'bond_paid': rental.bond_paid,
                })
            
            return Response(upcoming_payments)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'], url_path='customer-payments')
    def customer_payments(self, request):
        try:
            payments = Payment.objects.all().select_related('rental', 'rental__car').order_by('-payment_date')
            
            payment_data = []
            for payment in payments:
                payment_data.append({
                    'id': payment.id,
                    'payment_reference': payment.payment_reference,
                    'amount': float(payment.amount),
                    'status': payment.status,
                    'payment_type': payment.payment_type,
                    'payment_for_week': payment.payment_for_week,
                    'payment_date': payment.payment_date,
                    'notes': payment.notes,
                    'rental': {
                        'id': payment.rental.id,
                        'booking_reference': payment.rental.booking_reference,
                        'customer_name': payment.rental.customer_name,
                        'customer_email': payment.rental.customer_email,
                        'customer_phone': payment.rental.customer_phone,
                        'rental_type': payment.rental.rental_type,
                        'status': payment.rental.status,
                        'car_name': f"{payment.rental.car.brand} {payment.rental.car.name}" if payment.rental.car else 'N/A'
                    }
                })
            
            return Response(payment_data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    @action(detail=True, methods=['delete'], url_path='customer-payment')
    def delete_customer_payment(self, request, pk=None):
        try:
            payment = Payment.objects.get(pk=pk)
            payment.delete()
            return Response({'success': True, 'message': 'Payment deleted successfully'})
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=404)
    
    @action(detail=False, methods=['get'], url_path='all-services')
    def all_services(self, request):
        services = ServiceRecord.objects.all().select_related('plate_number').order_by('-id')
        serializer = ServiceRecordSerializer(services, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='services')
    def create_service_admin(self, request):
        serializer = ServiceRecordSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['put', 'patch'], url_path='service')
    def update_service_full(self, request, pk=None):
        try:
            service = ServiceRecord.objects.get(pk=pk)
        except ServiceRecord.DoesNotExist:
            return Response({'error': 'Service record not found'}, status=404)
        
        serializer = ServiceRecordSerializer(service, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['delete'], url_path='service')
    def delete_service(self, request, pk=None):
        try:
            service = ServiceRecord.objects.get(pk=pk)
            service.delete()
            return Response({'success': True, 'message': 'Service record deleted successfully'})
        except ServiceRecord.DoesNotExist:
            return Response({'error': 'Service record not found'}, status=404)
    
    @action(detail=True, methods=['patch'], url_path='service-complete')
    def complete_service_record(self, request, pk=None):
        try:
            service = ServiceRecord.objects.get(pk=pk)
            completed_on = request.data.get('completed_on', date.today())
            current_reading = request.data.get('current_reading')
            
            if current_reading:
                service.current_reading = current_reading
            
            service.completed_on = completed_on
            service.status = 'completed'
            
            if service.next_service_at:
                service.next_service_at = service.next_service_at + 10000
            
            service.save()
            serializer = ServiceRecordSerializer(service)
            return Response(serializer.data)
        except ServiceRecord.DoesNotExist:
            return Response({'error': 'Service record not found'}, status=404)
    
    @action(detail=False, methods=['get'], url_path='all-insurances')
    def all_insurances(self, request):
        insurances = Insurance.objects.all().select_related('plate_number').order_by('-id')
        serializer = InsuranceSerializer(insurances, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='insurances')
    def create_insurance_admin(self, request):
        serializer = InsuranceSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['put', 'patch'], url_path='insurance')
    def update_insurance_full(self, request, pk=None):
        try:
            insurance = Insurance.objects.get(pk=pk)
        except Insurance.DoesNotExist:
            return Response({'error': 'Insurance not found'}, status=404)
        
        serializer = InsuranceSerializer(insurance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['delete'], url_path='insurance')
    def delete_insurance(self, request, pk=None):
        try:
            insurance = Insurance.objects.get(pk=pk)
            insurance.delete()
            return Response({'success': True, 'message': 'Insurance deleted successfully'})
        except Insurance.DoesNotExist:
            return Response({'error': 'Insurance not found'}, status=404)
    
    @action(detail=False, methods=['get'], url_path='all-offences')
    def all_offences(self, request):
        offences = TollOffence.objects.all().order_by('-offence_date')
        serializer = TollOffenceSerializer(offences, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='offences')
    def create_offence_admin(self, request):
        serializer = TollOffenceSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['delete'], url_path='offence')
    def delete_offence(self, request, pk=None):
        try:
            offence = TollOffence.objects.get(pk=pk)
            offence.delete()
            return Response({'success': True, 'message': 'Offence deleted successfully'})
        except TollOffence.DoesNotExist:
            return Response({'error': 'Offence not found'}, status=404)
    
    @action(detail=True, methods=['patch'], url_path='offence-resolve')
    def resolve_offence_record(self, request, pk=None):
        try:
            offence = TollOffence.objects.get(pk=pk)
            offence.status = 'resolved'
            offence.save()
            
            if request.data.get('fine_amount'):
                IncomeExpense.objects.create(
                    date=date.today(),
                    type='expense',
                    category='toll',
                    amount=request.data.get('fine_amount'),
                    description=f"Fine payment - {offence.penalty_notice_number}",
                    reference=offence.penalty_notice_number
                )
            
            serializer = TollOffenceSerializer(offence)
            return Response(serializer.data)
        except TollOffence.DoesNotExist:
            return Response({'error': 'Offence not found'}, status=404)
    
    @action(detail=False, methods=['get'], url_path='all-gps-devices')
    def all_gps_devices(self, request):
        devices = GPSDevice.objects.all().select_related('plate_number').order_by('-id')
        serializer = GPSDeviceSerializer(devices, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='gps-devices')
    def create_gps_device_admin(self, request):
        serializer = GPSDeviceSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['delete'], url_path='gps-device')
    def delete_gps_device(self, request, pk=None):
        try:
            device = GPSDevice.objects.get(pk=pk)
            device.delete()
            return Response({'success': True, 'message': 'GPS device deleted successfully'})
        except GPSDevice.DoesNotExist:
            return Response({'error': 'GPS device not found'}, status=404)
    
    @action(detail=False, methods=['get'], url_path='all-claims')
    def all_claims(self, request):
        claims = Claim.objects.all().order_by('-event_date')
        serializer = ClaimSerializer(claims, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='claims')
    def create_claim_admin(self, request):
        serializer = ClaimSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['delete'], url_path='claim')
    def delete_claim(self, request, pk=None):
        try:
            claim = Claim.objects.get(pk=pk)
            claim.delete()
            return Response({'success': True, 'message': 'Claim deleted successfully'})
        except Claim.DoesNotExist:
            return Response({'error': 'Claim not found'}, status=404)
    
    @action(detail=True, methods=['patch'], url_path='claim-progress')
    def update_claim_progress(self, request, pk=None):
        try:
            claim = Claim.objects.get(pk=pk)
            progress = request.data.get('progress')
            if progress:
                claim.progress = progress
                claim.save()
                return Response({'success': True, 'progress': claim.progress})
            return Response({'error': 'Progress required'}, status=400)
        except Claim.DoesNotExist:
            return Response({'error': 'Claim not found'}, status=404)
    
    @action(detail=False, methods=['get'], url_path='all-install-status')
    def all_install_status(self, request):
        installs = InstallStatus.objects.all().select_related('plate_number').order_by('-id')
        serializer = InstallStatusSerializer(installs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], url_path='install-status')
    def create_install_status_admin(self, request):
        serializer = InstallStatusSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['delete'], url_path='install-status')
    def delete_install_status(self, request, pk=None):
        try:
            install = InstallStatus.objects.get(pk=pk)
            install.delete()
            return Response({'success': True, 'message': 'Install status deleted successfully'})
        except InstallStatus.DoesNotExist:
            return Response({'error': 'Install status not found'}, status=404)
    
    @action(detail=True, methods=['patch'], url_path='install-status-update')
    def update_install_status(self, request, pk=None):
        try:
            install = InstallStatus.objects.get(pk=pk)
            status = request.data.get('status')
            if status:
                install.status = status
                install.save()
                return Response({'success': True, 'status': install.status})
            return Response({'error': 'Status required'}, status=400)
        except InstallStatus.DoesNotExist:
            return Response({'error': 'Install status not found'}, status=404)
    
    @action(detail=False, methods=['get'])
    def income_expense_report(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date or not end_date:
            return Response({'error': 'start_date and end_date required'}, status=400)
        
        queryset = IncomeExpense.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).select_related('plate_number')
        
        income = queryset.filter(type='income').aggregate(total=Sum('amount'))['total'] or 0
        expenses = queryset.filter(type='expense').aggregate(total=Sum('amount'))['total'] or 0
        
        serializer = IncomeExpenseSerializer(queryset, many=True)
        
        return Response({
            'transactions': serializer.data,
            'summary': {
                'total_income': income,
                'total_expenses': expenses,
                'net_profit': income - expenses
            }
        })
    
    @action(detail=False, methods=['post'], url_path='transactions')
    def add_income_expense(self, request):
        serializer = IncomeExpenseSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['delete'], url_path='transaction')
    def delete_transaction(self, request, pk=None):
        try:
            transaction = IncomeExpense.objects.get(pk=pk)
            transaction.delete()
            return Response({'success': True, 'message': 'Transaction deleted successfully'})
        except IncomeExpense.DoesNotExist:
            return Response({'error': 'Transaction not found'}, status=404)

    @action(detail=False, methods=['post'], url_path='sync-income-expense')
    def sync_income_expense(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        try:
            completed_payments = Payment.objects.filter(status='completed')
            
            created_count = 0
            skipped_count = 0
            errors = []
            
            for payment in completed_payments:
                existing = IncomeExpense.objects.filter(reference=payment.payment_reference).first()
                if existing:
                    skipped_count += 1
                    continue
                
                result = create_income_from_payment(payment)
                if result:
                    created_count += 1
                else:
                    errors.append(f"Payment {payment.id}: Failed to create")
            
            return Response({
                'success': True,
                'message': f'Created {created_count} income records, skipped {skipped_count} existing, {len(errors)} errors',
                'created': created_count,
                'skipped': skipped_count,
                'errors': errors
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='create-income-for-payment')
    def create_income_for_payment(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        payment_id = request.data.get('payment_id')
        if not payment_id:
            return Response({'error': 'payment_id required'}, status=400)
        
        try:
            payment = Payment.objects.get(id=payment_id)
            
            existing = IncomeExpense.objects.filter(reference=payment.payment_reference).first()
            if existing:
                return Response({
                    'success': False,
                    'message': 'Income record already exists',
                    'income_id': existing.id
                })
            
            rental = payment.rental
            vehicle = None
            if rental.car:
                plate_number = f"CAR-{rental.car.id}"
                vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
            
            if payment.payment_type == 'signup':
                description = f"Signup fee - {rental.booking_reference} ({rental.customer_name})"
            elif payment.payment_type == 'bond':
                description = f"Bond payment - {rental.booking_reference} ({rental.customer_name})"
            else:
                description = f"Weekly payment #{payment.payment_for_week} - {rental.booking_reference} ({rental.customer_name})"
            
            income = IncomeExpense.objects.create(
                plate_number=vehicle,
                date=payment.payment_date.date() if payment.payment_date else date.today(),
                type='income',
                category='rental',
                amount=float(payment.amount),
                description=description,
                reference=payment.payment_reference
            )
            
            return Response({
                'success': True,
                'message': f'Income record created for payment {payment.payment_reference}',
                'income_id': income.id,
                'amount': float(payment.amount),
                'description': description
            })
            
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='mark-bond-paid')
    def mark_bond_paid(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        rental_id = request.data.get('rental_id')
        if not rental_id:
            return Response({'error': 'rental_id required'}, status=400)
        
        try:
            rental = Rental.objects.get(id=rental_id)
            rental.bond_paid = True
            rental.save()
            
            return Response({
                'success': True,
                'rental_id': rental.id,
                'bond_paid': rental.bond_paid,
                'message': 'Bond marked as paid successfully'
            })
        except Rental.DoesNotExist:
            return Response({'error': 'Rental not found'}, status=404)

    @action(detail=False, methods=['get'], url_path='check-income-expense')
    def check_income_expense(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        payments = Payment.objects.filter(status='completed').order_by('-payment_date')[:20]
        
        results = []
        for payment in payments:
            has_income = IncomeExpense.objects.filter(reference=payment.payment_reference).exists()
            results.append({
                'payment_id': payment.id,
                'payment_reference': payment.payment_reference,
                'amount': float(payment.amount),
                'payment_type': payment.payment_type,
                'payment_date': payment.payment_date,
                'has_income_record': has_income
            })
        
        return Response({
            'total_checked': len(results),
            'with_income': sum(1 for r in results if r['has_income_record']),
            'without_income': sum(1 for r in results if not r['has_income_record']),
            'payments': results
        })


    @action(detail=False, methods=['post'], url_path='sync-income-from-payments')
    def sync_income_from_payments(self, request):
        """Sync all completed payments to Income & Expenses"""
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        try:
            # Get all completed payments
            completed_payments = Payment.objects.filter(status='completed')
            
            created_count = 0
            skipped_count = 0
            errors = []
            
            for payment in completed_payments:
                # Check if income record already exists
                existing = IncomeExpense.objects.filter(reference=payment.payment_reference).first()
                if existing:
                    skipped_count += 1
                    continue
                
                try:
                    # Get vehicle
                    vehicle = None
                    if payment.rental and payment.rental.car:
                        plate_number = f"CAR-{payment.rental.car.id}"
                        vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
                        if not vehicle:
                            vehicle = Vehicle.objects.create(
                                plate_number=plate_number,
                                manufacturer=payment.rental.car.brand,
                                model=payment.rental.car.name,
                                year=payment.rental.car.model_year,
                                status='active'
                            )
                    
                    # Determine description based on payment type
                    if payment.payment_type == 'signup':
                        description = f"Signup fee - {payment.rental.booking_reference} ({payment.rental.customer_name})"
                    elif payment.payment_type == 'bond':
                        description = f"Bond payment - {payment.rental.booking_reference} ({payment.rental.customer_name})"
                    else:
                        week_info = f" Week #{payment.payment_for_week}" if payment.payment_for_week > 0 else ""
                        description = f"Weekly payment{week_info} - {payment.rental.booking_reference} ({payment.rental.customer_name})"
                    
                    # Create income record
                    IncomeExpense.objects.create(
                        plate_number=vehicle,
                        date=payment.payment_date.date() if payment.payment_date else date.today(),
                        type='income',
                        category='rental',
                        amount=float(payment.amount),
                        description=description,
                        reference=payment.payment_reference
                    )
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"{payment.payment_reference}: {str(e)}")
            
            return Response({
                'success': True,
                'message': f'✅ Synced {created_count} payments to Income & Expenses. Skipped {skipped_count} existing records.',
                'created': created_count,
                'skipped': skipped_count,
                'errors': errors
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    # Add this to AdminDashboardViewSet in views.py
    @action(detail=False, methods=['post'], url_path='fix-payment-income')
    def fix_payment_income(self, request):
        """Create missing income records for completed payments"""
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        payment_ref = request.data.get('payment_reference')
        
        if payment_ref:
            # Fix specific payment
            try:
                payment = Payment.objects.get(payment_reference=payment_ref)
            except Payment.DoesNotExist:
                return Response({'error': f'Payment {payment_ref} not found'}, status=404)
            
            existing = IncomeExpense.objects.filter(reference=payment.payment_reference).first()
            if existing:
                return Response({
                    'message': f'Income already exists for {payment_ref}',
                    'income_id': existing.id
                })
            
            # Get vehicle
            vehicle = None
            if payment.rental.car:
                plate_number = f"CAR-{payment.rental.car.id}"
                vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
            
            # Create income record
            income = IncomeExpense.objects.create(
                plate_number=vehicle,
                date=payment.payment_date.date() if payment.payment_date else date.today(),
                type='income',
                category='rental',
                amount=float(payment.amount),
                description=f"{payment.payment_type} - {payment.rental.booking_reference} ({payment.rental.customer_name})",
                reference=payment.payment_reference
            )
            
            return Response({
                'success': True,
                'message': f'Created income record for {payment_ref}',
                'income_id': income.id,
                'amount': float(payment.amount)
            })
        else:
            # Fix all payments
            payments = Payment.objects.filter(status='completed')
            created = 0
            skipped = 0
            
            for payment in payments:
                existing = IncomeExpense.objects.filter(reference=payment.payment_reference).first()
                if existing:
                    skipped += 1
                    continue
                
                vehicle = None
                if payment.rental.car:
                    plate_number = f"CAR-{payment.rental.car.id}"
                    vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
                
                IncomeExpense.objects.create(
                    plate_number=vehicle,
                    date=payment.payment_date.date() if payment.payment_date else date.today(),
                    type='income',
                    category='rental',
                    amount=float(payment.amount),
                    description=f"{payment.payment_type} - {payment.rental.booking_reference} ({payment.rental.customer_name})",
                    reference=payment.payment_reference
                )
                created += 1
            
            return Response({
                'success': True,
                'message': f'Created {created} income records, skipped {skipped} existing',
                'created': created,
                'skipped': skipped
            })

    @action(detail=False, methods=['get'], url_path='fix-payment/(?P<ref>[^/.]+)')
    def fix_single_payment(self, request, ref=None):
        """Fix a single payment by reference - GET endpoint"""
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        try:
            payment = Payment.objects.get(payment_reference=ref)
        except Payment.DoesNotExist:
            return Response({'error': f'Payment {ref} not found'}, status=404)
        
        existing = IncomeExpense.objects.filter(reference=payment.payment_reference).first()
        if existing:
            return Response({
                'success': False,
                'message': f'Income record already exists for payment {ref}',
                'income_id': existing.id,
                'amount': float(existing.amount)
            })
        
        income = create_income_from_payment(payment)
        if income:
            return Response({
                'success': True,
                'message': f'✅ Created income record for payment {ref}',
                'income_id': income.id,
                'amount': float(payment.amount),
                'description': income.description
            })
        else:
            return Response({
                'success': False,
                'error': f'Failed to create income record for {ref}'
            }, status=500)


    @action(detail=False, methods=['get'], url_path='service-dashboard')
    def service_dashboard(self, request):
        """Get all vehicles with service information"""
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        try:
            # First, ensure columns exist
            from django.db import connection
            with connection.cursor() as cursor:
                columns_to_add = [
                    ('current_odometer', 'INTEGER DEFAULT 0'),
                    ('last_service_odometer', 'INTEGER DEFAULT 0'),
                    ('service_interval_km', 'INTEGER DEFAULT 10000'),
                    ('next_service_odometer', 'INTEGER DEFAULT 10000'),
                    ('last_service_date', 'DATE NULL'),
                    ('next_service_date', 'DATE NULL'),
                    ('service_status', "VARCHAR(50) DEFAULT 'ok'"),
                ]
                for col_name, col_type in columns_to_add:
                    try:
                        cursor.execute(f'ALTER TABLE cars_vehicle ADD COLUMN IF NOT EXISTS {col_name} {col_type}')
                    except Exception:
                        pass
            
            vehicles = Vehicle.objects.all()
            
            service_data = []
            today = date.today()
            
            for vehicle in vehicles:
                # Get current odometer (with safe default)
                current_km = getattr(vehicle, 'current_odometer', 0) or 0
                next_service_km = getattr(vehicle, 'next_service_odometer', 10000) or 10000
                service_interval = getattr(vehicle, 'service_interval_km', 10000) or 10000
                
                # Calculate service status
                if current_km >= next_service_km:
                    status = 'due_now'
                    status_text = 'Service Due Now!'
                    status_color = 'bg-red-100 text-red-800'
                    urgency = 'high'
                elif current_km >= next_service_km - 2000:
                    status = 'due_soon'
                    status_text = 'Service Due Soon'
                    status_color = 'bg-yellow-100 text-yellow-800'
                    urgency = 'medium'
                elif current_km > next_service_km + 5000:
                    status = 'overdue'
                    status_text = 'Service Overdue!'
                    status_color = 'bg-red-200 text-red-900'
                    urgency = 'critical'
                else:
                    status = 'ok'
                    status_text = 'OK'
                    status_color = 'bg-green-100 text-green-800'
                    urgency = 'low'
                
                # Kilometers until service
                km_until_service = max(0, next_service_km - current_km)
                
                # Get last service info
                last_service_date = getattr(vehicle, 'last_service_date', None)
                last_service_odometer = getattr(vehicle, 'last_service_odometer', 0) or 0
                
                # Calculate days since last service
                days_since_service = (today - last_service_date).days if last_service_date else None
                
                # Get associated car info
                associated_car = None
                if vehicle.plate_number and vehicle.plate_number.startswith('CAR-'):
                    try:
                        car_id = int(vehicle.plate_number.split('-')[1])
                        car = Car.objects.filter(id=car_id).first()
                        if car:
                            associated_car = {
                                'id': car.id,
                                'name': car.name,
                                'brand': car.brand,
                            }
                    except:
                        pass
                
                # Get current driver
                current_driver = vehicle.drivers.filter(is_current=True).first()
                
                service_data.append({
                    'id': vehicle.id,
                    'plate_number': vehicle.plate_number,
                    'manufacturer': vehicle.manufacturer or 'N/A',
                    'model': vehicle.model or 'N/A',
                    'year': vehicle.year,
                    'colour': vehicle.colour,
                    'current_odometer': current_km,
                    'next_service_odometer': next_service_km,
                    'service_interval_km': service_interval,
                    'km_until_service': km_until_service,
                    'last_service_date': last_service_date,
                    'last_service_odometer': last_service_odometer,
                    'days_since_service': days_since_service,
                    'status': status,
                    'status_text': status_text,
                    'status_color': status_color,
                    'urgency': urgency,
                    'current_driver': {
                        'name': current_driver.name if current_driver else None,
                        'phone': current_driver.phone_number if current_driver else None,
                    } if current_driver else None,
                    'associated_car': associated_car,
                })
            
            # Calculate summary statistics
            summary = {
                'total_vehicles': len(service_data),
                'due_now': len([v for v in service_data if v['status'] == 'due_now']),
                'due_soon': len([v for v in service_data if v['status'] == 'due_soon']),
                'overdue': len([v for v in service_data if v['status'] == 'overdue']),
                'ok': len([v for v in service_data if v['status'] == 'ok']),
            }
            
            return Response({
                'vehicles': service_data,
                'summary': summary
            })
            
        except Exception as e:
            print(f"Error in service dashboard: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': str(e),
                'vehicles': [],
                'summary': {
                    'total_vehicles': 0,
                    'due_now': 0,
                    'due_soon': 0,
                    'overdue': 0,
                    'ok': 0
                }
            }, status=200)  # Return 200 with empty data instead of 500

    @action(detail=False, methods=['post'], url_path='update-odometer')
    def update_odometer(self, request):
        """Update vehicle odometer reading"""
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        vehicle_id = request.data.get('vehicle_id')
        new_odometer = request.data.get('current_odometer')
        
        if not vehicle_id or not new_odometer:
            return Response({'error': 'vehicle_id and current_odometer required'}, status=400)
        
        try:
            vehicle = Vehicle.objects.get(id=vehicle_id)
            old_odometer = vehicle.current_odometer
            vehicle.current_odometer = int(new_odometer)
            
            # Auto-update service status
            vehicle.update_service_status()
            
            vehicle.save()
            
            return Response({
                'success': True,
                'message': f'Odometer updated from {old_odometer} to {vehicle.current_odometer} km',
                'current_odometer': vehicle.current_odometer,
                'service_status': vehicle.service_status,
                'next_service_odometer': vehicle.next_service_odometer
            })
            
        except Vehicle.DoesNotExist:
            return Response({'error': 'Vehicle not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='sync-service-records')
    def sync_service_records(self, request):
        """Sync vehicle service data to ServiceRecord model"""
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        try:
            vehicles = Vehicle.objects.all()
            created_count = 0
            updated_count = 0
            errors = []
            
            for vehicle in vehicles:
                try:
                    # Get or create ServiceRecord for this vehicle
                    service_record, created = ServiceRecord.objects.get_or_create(
                        plate_number=vehicle,
                        defaults={
                            'driver_name': vehicle.drivers.filter(is_current=True).first().name if vehicle.drivers.filter(is_current=True).first() else '',
                            'current_reading': getattr(vehicle, 'current_odometer', 0) or 0,
                            'next_service_at': getattr(vehicle, 'next_service_odometer', 10000) or 10000,
                            'status': getattr(vehicle, 'service_status', 'ok'),
                        }
                    )
                    
                    if not created:
                        # Update existing record
                        service_record.current_reading = getattr(vehicle, 'current_odometer', 0) or 0
                        service_record.next_service_at = getattr(vehicle, 'next_service_odometer', 10000) or 10000
                        service_record.status = getattr(vehicle, 'service_status', 'ok')
                        service_record.save()
                        updated_count += 1
                    else:
                        created_count += 1
                        
                except Exception as e:
                    errors.append(f"Vehicle {vehicle.plate_number}: {str(e)}")
            
            return Response({
                'success': True,
                'message': f'Created {created_count}, Updated {updated_count} service records',
                'created': created_count,
                'updated': updated_count,
                'errors': errors
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)


    @action(detail=False, methods=['post'], url_path='record-service')
    def record_service(self, request):
        """Record that service has been performed"""
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)
        
        vehicle_id = request.data.get('vehicle_id')
        service_odometer = request.data.get('service_odometer')
        service_date = request.data.get('service_date', date.today().isoformat())
        notes = request.data.get('notes', '')
        
        if not vehicle_id or not service_odometer:
            return Response({'error': 'vehicle_id and service_odometer required'}, status=400)
        
        try:
            vehicle = Vehicle.objects.get(id=vehicle_id)
            
            # Update service records
            vehicle.last_service_odometer = int(service_odometer)
            vehicle.last_service_date = service_date
            vehicle.next_service_odometer = int(service_odometer) + vehicle.service_interval_km
            vehicle.current_odometer = max(vehicle.current_odometer, int(service_odometer))
            
            # Update service status
            vehicle.update_service_status()
            
            vehicle.save()
            
            # Create service record in ServiceRecord model if you have one
            ServiceRecord.objects.create(
                plate_number=vehicle,
                driver_name=request.data.get('driver_name', ''),
                current_reading=int(service_odometer),
                next_service_at=vehicle.next_service_odometer,
                completed_on=service_date,
                status='completed',
                notes=notes
            )
            
            return Response({
                'success': True,
                'message': f'Service recorded for {vehicle.plate_number} at {service_odometer} km',
                'next_service_odometer': vehicle.next_service_odometer,
                'service_status': vehicle.service_status
            })
            
        except Vehicle.DoesNotExist:
            return Response({'error': 'Vehicle not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)        



    @action(detail=False, methods=['post'], url_path='fetch-gps-odometer')
    def fetch_gps_odometer(self, request):
        """
        Fetch live mileage from WhatsGPS and update vehicle odometers.

        Request body (optional):
          {
            "vehicle_ids": [1, 2, 3]   // omit to update ALL vehicles with GPS
          }

        WhatsGPS credentials come from:
          - settings.WHATSGPS_BASE_URL   (default "https://www.whatsgps.com")
          - settings.WHATSGPS_USERNAME
          - settings.WHATSGPS_PASSWORD
        """
        if not request.user.is_staff:
            return Response({'error': 'Admin only'}, status=403)

        GPS_BASE = getattr(settings, 'WHATSGPS_BASE_URL', 'https://www.whatsgps.com')
        GPS_USER = getattr(settings, 'WHATSGPS_USERNAME', '')
        GPS_PASS = getattr(settings, 'WHATSGPS_PASSWORD', '')

        if not GPS_USER or not GPS_PASS:
            return Response({
                'error': (
                    'WhatsGPS credentials not configured. '
                    'Set WHATSGPS_USERNAME and WHATSGPS_PASSWORD in your environment.'
                )
            }, status=400)

        # ── 1. Login to WhatsGPS ─────────────────────────────────────────────
        try:
            login_resp = http_requests.get(
                f"{GPS_BASE}/user/login.do",
                params={
                    'name': GPS_USER,
                    'password': GPS_PASS,
                    'timeZoneSecond': 36000,   # UTC+10 (Australia)
                    'lang': 'en',
                },
                timeout=15,
            )
            login_data = login_resp.json()
        except Exception as e:
            return Response({'error': f'WhatsGPS login failed: {str(e)}'}, status=502)

        if login_data.get('ret') != 1:
            return Response({
                'error': f'WhatsGPS login rejected. ret={login_data.get("ret")}'
            }, status=401)

        token = login_data.get('data', {}).get('token') or login_data.get('data', {}).get('userToken')
        if not token:
            return Response({'error': 'No token returned from WhatsGPS login'}, status=502)

        # ── 2. Decide which vehicles to update ───────────────────────────────
        vehicle_ids = request.data.get('vehicle_ids')
        if vehicle_ids:
            devices = GPSDevice.objects.filter(
                plate_number__id__in=vehicle_ids
            ).select_related('plate_number')
        else:
            devices = GPSDevice.objects.filter(
                new_tracker_no__isnull=False
            ).exclude(new_tracker_no='').select_related('plate_number')

        if not devices.exists():
            return Response({
                'message': 'No GPS devices found to update.',
                'updated': 0,
                'errors': [],
            })

        # Build a map: car_id (WhatsGPS) → GPSDevice
        # new_tracker_no stores the WhatsGPS carId (numeric device ID)
        car_id_map = {}
        for device in devices:
            tracker = (device.new_tracker_no or '').strip()
            if tracker:
                car_id_map[tracker] = device

        if not car_id_map:
            return Response({'message': 'No tracker IDs configured on GPS devices.', 'updated': 0, 'errors': []})

        # ── 3. Fetch vehicle status from WhatsGPS ────────────────────────────
        # carStatus/getByCarIds.do accepts comma-separated carIds
        car_ids_str = ','.join(car_id_map.keys())
        try:
            status_resp = http_requests.get(
                f"{GPS_BASE}/carStatus/getByCarIds.do",
                params={
                    'token': token,
                    'carIds': car_ids_str,
                    'mapType': 0,   # original coordinates
                },
                timeout=20,
            )
            status_data = status_resp.json()
        except Exception as e:
            return Response({'error': f'WhatsGPS status fetch failed: {str(e)}'}, status=502)

        if status_data.get('ret') != 1:
            return Response({
                'error': f'WhatsGPS status error. ret={status_data.get("ret")}'
            }, status=502)

        # ── 4. Also try mileage via position/distanceSta.do if needed ─────────
        # The carStatus endpoint returns cumulative mileage in the 'mileage' field.
        # That is the odometer value we need.
        car_statuses = status_data.get('data', [])
        if not isinstance(car_statuses, list):
            car_statuses = [car_statuses]  # single result

        # Build map: carId (str) → mileage (int, metres → km)
        gps_mileage = {}
        for car_status in car_statuses:
            cid = str(car_status.get('carId', ''))
            raw_mileage = car_status.get('mileage', 0) or 0
            # WhatsGPS returns mileage in metres; convert to km
            km = int(round(raw_mileage / 1000))
            gps_mileage[cid] = km

        # ── 5. Update vehicle odometers ──────────────────────────────────────
        updated = []
        skipped = []
        errors = []

        for car_id_str, device in car_id_map.items():
            vehicle = device.plate_number
            if car_id_str not in gps_mileage:
                skipped.append({
                    'plate': vehicle.plate_number,
                    'reason': 'No data returned from WhatsGPS for this device',
                })
                continue

            gps_km = gps_mileage[car_id_str]
            old_km = getattr(vehicle, 'current_odometer', 0) or 0

            # Only update if GPS reading is larger (odometers don't go backwards)
            if gps_km > old_km:
                try:
                    from django.db import connection
                    # Ensure column exists (safe for production)
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "ALTER TABLE cars_vehicle ADD COLUMN IF NOT EXISTS current_odometer INTEGER DEFAULT 0"
                        )
                    vehicle.current_odometer = gps_km
                    vehicle.save(update_fields=['current_odometer'])
                    updated.append({
                        'plate': vehicle.plate_number,
                        'old_km': old_km,
                        'new_km': gps_km,
                        'delta_km': gps_km - old_km,
                    })
                except Exception as e:
                    errors.append({
                        'plate': vehicle.plate_number,
                        'error': str(e),
                    })
            else:
                skipped.append({
                    'plate': vehicle.plate_number,
                    'reason': f'GPS reading {gps_km} km ≤ current {old_km} km (no change)',
                })

        return Response({
            'message': f'GPS sync complete. Updated {len(updated)} vehicles.',
            'updated': len(updated),
            'vehicles_updated': updated,
            'skipped': skipped,
            'errors': errors,
        })

