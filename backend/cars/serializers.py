from datetime import datetime, timedelta
from rest_framework import serializers
from .models import *
from django.contrib.auth.models import User


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['phone', 'address', 'city', 'state', 'country', 'postal_code', 
                  'user_type', 'business_name', 'abn', 'profile_picture', 'is_verified']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile', 'date_joined', 'is_staff', 'is_superuser']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    user_type = serializers.ChoiceField(choices=UserProfile.USER_TYPE_CHOICES, write_only=True, required=False)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'confirm_password', 'first_name', 'last_name', 'phone', 'user_type']
    
    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match")
        return data
    
    def create(self, validated_data):
        phone = validated_data.pop('phone', '')
        user_type = validated_data.pop('user_type', 'individual')
        validated_data.pop('confirm_password')
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        
        # Update profile with additional info
        if phone or user_type:
            profile = user.profile
            if phone:
                profile.phone = phone
            if user_type:
                profile.user_type = user_type
            profile.save()
        
        return user

class CarImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = CarImage
        fields = ['id', 'image', 'image_url', 'is_primary']
    
    def get_image(self, obj):
        # Only return local image URL if it exists (for backward compatibility)
        if obj.image and obj.image.name:
            try:
                return obj.image.url
            except:
                return None
        return None
    
    def get_image_url(self, obj):
        # Return Cloudinary URL first
        if obj.image_url:
            return obj.image_url
        # Fallback to local image URL
        return self.get_image(obj)

class CarSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()
    owner_username = serializers.ReadOnlyField(source='owner.username')
    owner_email = serializers.ReadOnlyField(source='owner.email')
    weekly_savings = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()
    main_image = serializers.SerializerMethodField()
    calculated_rent_to_own_price = serializers.SerializerMethodField()
    rent_to_own_weekly = serializers.SerializerMethodField()
    rent_to_own_total_weeks = serializers.SerializerMethodField()
    rent_to_own_total_cost = serializers.SerializerMethodField()
    
    class Meta:
        model = Car
        fields = '__all__'
        read_only_fields = ['owner', 'created_at', 'updated_at']

    def get_calculated_rent_to_own_price(self, obj):
        """Calculate rent-to-own weekly price using Excel formula"""
        if obj.car_value and obj.car_value > 0:
            weekly, total_weeks, total_cost = obj.calculate_rent_to_own_weekly()
            return weekly
        return 0
    
    def get_rent_to_own_weekly(self, obj):
        """Get weekly payment for rent-to-own"""
        if obj.car_value and obj.car_value > 0:
            weekly, _, _ = obj.calculate_rent_to_own_weekly()
            return weekly
        return 0
    
    def get_rent_to_own_total_weeks(self, obj):
        """Get total number of weeks for rent-to-own"""
        if obj.car_value and obj.car_value > 0:
            _, total_weeks, _ = obj.calculate_rent_to_own_weekly()
            return total_weeks
        return 0
    
    def get_rent_to_own_total_cost(self, obj):
        """Get total contract value for rent-to-own"""
        if obj.car_value and obj.car_value > 0:
            _, _, total_cost = obj.calculate_rent_to_own_weekly()
            return total_cost
        return 0
    
    def get_images(self, obj):
        images = obj.images.all()
        return [
            {
                'id': img.id,
                'image': img.image.url if img.image and img.image.name else None,
                'image_url': img.image_url,
                'is_primary': img.is_primary
            }
            for img in images
        ]
    
    def get_weekly_savings(self, obj):
        if obj.weekly_price > 0:
            daily_total = float(obj.daily_price) * 7
            return round(daily_total - float(obj.weekly_price), 2)
        return 0
    
    def get_is_available(self, obj):
        return obj.available_units > 0

    def get_main_image(self, obj):
        primary_image = obj.images.filter(is_primary=True).first()
        if primary_image:
            if primary_image.image_url:
                return primary_image.image_url
            if primary_image.image and primary_image.image.name:
                return primary_image.image.url
        
        first_image = obj.images.first()
        if first_image:
            if first_image.image_url:
                return first_image.image_url
            if first_image.image and first_image.image.name:
                return first_image.image.url
        return None

class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['id', 'name', 'email', 'subject', 'message', 'is_read', 'created_at']
        read_only_fields = ['is_read', 'created_at']    

class RentalSerializer(serializers.ModelSerializer):
    car_details = CarSerializer(source='car', read_only=True)
    weekly_price_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Rental
        fields = '__all__'
        read_only_fields = ['total_price', 'created_at', 'booking_reference']
    
    def get_weekly_price_display(self, obj):
        if obj.rental_type == 'weekly':
            return obj.weekly_price or (obj.car.weekly_price if obj.car else 0)
        return None
    
    def validate(self, data):
        # Validate total price calculation
        rental_type = data.get('rental_type', self.instance.rental_type if self.instance else None)
        weeks = data.get('weeks', self.instance.weeks if self.instance else 0)
        weekly_price = data.get('weekly_price', 0)
        car = data.get('car', self.instance.car if self.instance else None)
        
        if rental_type == 'weekly' and weeks > 0:
            if weekly_price == 0 and car:
                weekly_price = float(car.weekly_price)
            expected_total = weekly_price * weeks
            if data.get('total_price', 0) != expected_total:
                # Auto-correct the total price
                data['total_price'] = expected_total
                if 'weekly_price' not in data and weekly_price > 0:
                    data['weekly_price'] = weekly_price
        
        return data
        
        
class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = '__all__'

class DriverSerializer(serializers.ModelSerializer):
    vehicle_plate = serializers.CharField(source='plate_number.plate_number', read_only=True)
    
    class Meta:
        model = Driver
        fields = '__all__'

class InsuranceSerializer(serializers.ModelSerializer):
    vehicle_plate = serializers.CharField(source='plate_number.plate_number', read_only=True)
    is_expiring_soon = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Insurance
        fields = '__all__'

class GPSDeviceSerializer(serializers.ModelSerializer):
    vehicle_plate = serializers.CharField(source='plate_number.plate_number', read_only=True)
    
    class Meta:
        model = GPSDevice
        fields = '__all__'

class ServiceRecordSerializer(serializers.ModelSerializer):
    vehicle_plate = serializers.CharField(source='plate_number.plate_number', read_only=True)
    is_service_due = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ServiceRecord
        fields = '__all__'

class TollOffenceSerializer(serializers.ModelSerializer):
    is_overdue = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = TollOffence
        fields = '__all__'

class PaymentLedgerSerializer(serializers.ModelSerializer):
    vehicle_plate = serializers.CharField(source='plate_number.plate_number', read_only=True)
    is_late = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = PaymentLedger
        fields = '__all__'

class IncomeExpenseSerializer(serializers.ModelSerializer):
    vehicle_plate = serializers.CharField(source='plate_number.plate_number', read_only=True, allow_null=True)
    
    class Meta:
        model = IncomeExpense
        fields = '__all__'

class InstallStatusSerializer(serializers.ModelSerializer):
    vehicle_plate = serializers.CharField(source='plate_number.plate_number', read_only=True)
    
    class Meta:
        model = InstallStatus
        fields = '__all__'

class ClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = Claim
        fields = '__all__'

# Add to existing serializers.py

class VehicleDetailSerializer(serializers.ModelSerializer):
    current_driver = serializers.SerializerMethodField()
    active_insurance = serializers.SerializerMethodField()
    gps_device = serializers.SerializerMethodField()
    is_registration_expiring = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Vehicle
        fields = '__all__'
    
    def get_current_driver(self, obj):
        driver = obj.drivers.filter(is_current=True).first()
        return DriverSerializer(driver).data if driver else None
    
    def get_active_insurance(self, obj):
        insurance = obj.insurances.filter(status='active').first()
        return InsuranceSerializer(insurance).data if insurance else None
    
    def get_gps_device(self, obj):
        device = obj.gps_devices.first()
        return GPSDeviceSerializer(device).data if device else None

class DashboardSummarySerializer(serializers.Serializer):
    total_vehicles = serializers.IntegerField()
    active_vehicles = serializers.IntegerField()
    expiring_registrations = serializers.IntegerField()
    active_drivers = serializers.IntegerField()
    total_drivers = serializers.IntegerField()
    pending_payments = serializers.IntegerField()
    overdue_payments = serializers.IntegerField()
    total_due = serializers.DecimalField(max_digits=12, decimal_places=2)
    expiring_insurances = serializers.IntegerField()
    services_due = serializers.IntegerField()
    services_due_soon = serializers.IntegerField()
    outstanding_offences = serializers.IntegerField()
    overdue_offences = serializers.IntegerField()
    monthly_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    monthly_expenses = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_profit = serializers.DecimalField(max_digits=12, decimal_places=2)