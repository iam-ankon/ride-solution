from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete, pre_delete
from django.dispatch import receiver
from datetime import timedelta
from django.core.validators import FileExtensionValidator, MinValueValidator, MaxValueValidator
from datetime import date, timedelta
import math


class UserProfile(models.Model):
    USER_TYPE_CHOICES = [
        ('individual', 'Individual'),
        ('business', 'Business'),
        ('dealer', 'Car Dealer'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, default='Australia')
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default='individual')
    business_name = models.CharField(max_length=200, blank=True, null=True)
    abn = models.CharField(max_length=50, blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profiles/%Y/%m/%d/', blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username}'s Profile"
    
    @property
    def full_name(self):
        return f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()


class Car(models.Model):
    FUEL_CHOICES = [
        ('Petrol', 'Petrol'),
        ('Diesel', 'Diesel'),
        ('Electric', 'Electric'),
        ('Hybrid', 'Hybrid'),
    ]
    
    TRANSMISSION_CHOICES = [
        ('Manual', 'Manual'),
        ('Automatic', 'Automatic'),
    ]
    
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('rented', 'Rented'),
        ('maintenance', 'Under Maintenance'),
        ('booked_out', 'Booked Out'),
    ]
    
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cars', null=True, blank=True)
    name = models.CharField(max_length=100)
    brand = models.CharField(max_length=100)
    model_year = models.IntegerField(default=2026)
    
    daily_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    weekly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    rent_to_own_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    short_term_available = models.BooleanField(default=True, help_text="Enable daily/short term rentals")
    long_term_available = models.BooleanField(default=True, help_text="Enable weekly/long term rentals")
    rent_to_own_available = models.BooleanField(default=True, help_text="Enable rent to own option")

    car_value = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Base value of the car in AUD")
    rent_to_own_years = models.IntegerField(default=2, help_text="Rent to own period in years")
    
    interest_rate = models.DecimalField(max_digits=5, decimal_places=4, default=0.095, 
                                         help_text="Interest rate per annum (e.g., 0.095 = 9.5%)")
    ongoing_cost_weekly = models.DecimalField(max_digits=10, decimal_places=2, default=79.00,
                                               help_text="Weekly ongoing cost (rego, insurance, general service)")
    service_fee_weekly = models.DecimalField(max_digits=10, decimal_places=2, default=55.00,
                                              help_text="Weekly service fee for business operation cost")
    
    rent_to_own_term = models.IntegerField(default=36)
    min_rental_days = models.IntegerField(default=1)
    
    total_units = models.IntegerField(default=0, help_text="Total number of this car model available")
    available_units = models.IntegerField(default=0, help_text="Currently available units")
    max_weekly_bookings = models.IntegerField(default=5, help_text="Maximum bookings per week")
    
    fuel_type = models.CharField(max_length=50, choices=FUEL_CHOICES, default='Petrol')
    transmission = models.CharField(max_length=50, choices=TRANSMISSION_CHOICES, default='Automatic')
    seats = models.IntegerField(default=5)
    luggage_capacity = models.IntegerField(default=2)
    description = models.TextField(default='', blank=True)
    features = models.TextField(default='', blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    bond_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Optional refundable bond amount (set 0 for no bond)"
    )
    bond_refundable = models.BooleanField(
        default=True, 
        help_text="Is the bond refundable?"
    )
    bond_terms = models.TextField(
        blank=True, 
        default="Bond is fully refundable upon return of the vehicle in good condition, no damage, and no outstanding fines or tolls.",
        help_text="Terms and conditions for bond refund"
    )

    signup_fee = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Signup fee to book the car (paid upfront, non-refundable)"
    )
    signup_fee_description = models.TextField(
        blank=True, 
        default="Signup fee covers booking processing and administrative costs.",
        help_text="Description of signup fee"
    )
    
    def __str__(self):
        return f"{self.brand} {self.name} ({self.model_year})"

    def save(self, *args, **kwargs):
        if self.status == 'booked_out':
            self.available_units = 0
        super().save(*args, **kwargs)

    def calculate_rent_to_own_weekly(self, months=None):
        """Calculate weekly rent-to-own payment using the comprehensive Excel formula"""
        if not self.car_value or self.car_value <= 0:
            return 0, 0, 0
        
        months = months or self.rent_to_own_years * 12
        years = months / 12
        
        car_value = float(self.car_value)
        interest_rate = float(getattr(self, 'interest_rate', 0.095))
        ongoing_cost = float(getattr(self, 'ongoing_cost_weekly', 79.00))
        service_fee = float(getattr(self, 'service_fee_weekly', 55.00))
        
        total_weeks = int(math.ceil(years * 52.1775))
        interest_total = car_value * interest_rate * years
        ongoing_total = ongoing_cost * total_weeks
        service_total = service_fee * total_weeks
        
        total_cost = car_value + interest_total + ongoing_total + service_total
        weekly_payment = total_cost / total_weeks
        
        return round(weekly_payment, 2), total_weeks, round(total_cost, 2)
    
    def is_available_for_dates(self, start_date, end_date):
        overlapping_confirmed = Rental.objects.filter(
            car=self,
            status__in=['confirmed', 'active'],
            start_date__lt=end_date,
            end_date__gt=start_date
        ).count()
        return overlapping_confirmed < self.total_units
    
    def get_booked_dates(self):
        booked_rentals = Rental.objects.filter(
            car=self,
            status__in=['confirmed', 'active']
        )
        booked_dates = []
        for rental in booked_rentals:
            current = rental.start_date.date()
            while current <= rental.end_date.date():
                booked_dates.append(current.isoformat())
                current += timedelta(days=1)
        return booked_dates
    
    def update_status_based_on_bookings(self):
        active_bookings = Rental.objects.filter(
            car=self,
            status__in=['confirmed', 'active']
        ).count()
        
        self.available_units = max(0, self.total_units - active_bookings)
        
        if self.available_units == 0:
            self.status = 'booked_out'
        elif self.available_units < self.total_units:
            self.status = 'rented'
        else:
            self.status = 'available'
        
        self.save(update_fields=['status', 'available_units'])


class CarImage(models.Model):
    car = models.ForeignKey(Car, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(
        upload_to='cars/%Y/%m/%d/',
        validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'webp'])],
        blank=True,
        null=True
    )
    image_url = models.URLField(max_length=500, blank=True, null=True)
    is_primary = models.BooleanField(default=False)
    public_id = models.CharField(max_length=200, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.car.name} - {'Primary' if self.is_primary else 'Image'}"
    
    @property
    def display_url(self):
        if self.image_url:
            return self.image_url
        if self.image:
            return self.image.url
        return None


class Rental(models.Model):
    RENTAL_TYPE_CHOICES = [
        ('daily', 'Daily Rental'),
        ('weekly', 'Weekly Rental'),
        ('rent_to_own', 'Rent to Own'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending Payment'),
        ('confirmed', 'Confirmed'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    stripe_session_id = models.CharField(max_length=200, blank=True, null=True)
    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name='rentals')
    renter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rentals', null=True, blank=True)
    rental_type = models.CharField(max_length=20, choices=RENTAL_TYPE_CHOICES, default='daily')
    customer_name = models.CharField(max_length=100)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=20)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    days = models.IntegerField(default=0)
    weeks = models.IntegerField(default=0)
    months = models.IntegerField(default=0)
    weekly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    special_requests = models.TextField(blank=True, default='')
    booking_reference = models.CharField(max_length=20, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    bond_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    bond_paid = models.BooleanField(default=False)
    bond_refunded = models.BooleanField(default=False)
    bond_refund_date = models.DateTimeField(blank=True, null=True)
    bond_payment_id = models.CharField(max_length=255, blank=True, null=True)
    signup_fee_paid = models.BooleanField(default=False)
    signup_fee_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    def calculate_rent_to_own_weekly(self):
        import math
        
        if not self.car or not self.car.car_value or self.car.car_value <= 0:
            return 0, 0, 0
        
        months = self.months or 24
        years = months / 12
        
        car_value = float(self.car.car_value)
        interest_rate = float(getattr(self.car, 'interest_rate', 0.095))
        ongoing_cost_weekly = float(getattr(self.car, 'ongoing_cost_weekly', 79.00))
        service_fee_weekly = float(getattr(self.car, 'service_fee_weekly', 55.00))
        
        total_weeks = int(math.ceil(years * 52.1775))
        interest_total = car_value * interest_rate * years
        ongoing_total = ongoing_cost_weekly * total_weeks
        service_total = service_fee_weekly * total_weeks
        
        total_cost = car_value + interest_total + ongoing_total + service_total
        weekly_payment = total_cost / total_weeks
        
        return round(weekly_payment, 2), total_weeks, round(total_cost, 2)
    
    def save(self, *args, **kwargs):
        if not self.booking_reference:
            import uuid
            self.booking_reference = f"RS-{uuid.uuid4().hex[:8].upper()}"
        
        if self.rental_type == 'rent_to_own' and self.months > 0:
            if self.car and self.car.car_value and self.car.car_value > 0:
                weekly_price, total_weeks, total_cost = self.calculate_rent_to_own_weekly()
                self.weekly_price = weekly_price
                self.total_price = total_cost
        elif self.rental_type == 'weekly' and self.weeks > 0:
            if self.weekly_price == 0 and self.car:
                self.weekly_price = float(self.car.weekly_price)
            self.total_price = self.weekly_price * self.weeks
        elif self.rental_type == 'daily' and self.days > 0:
            self.total_price = float(self.car.daily_price) * self.days if self.car else 0
        
        super().save(*args, **kwargs)
        
        if self.status in ['confirmed', 'active']:
            self.car.update_status_based_on_bookings()
    
    def __str__(self):
        return f"{self.customer_name} - {self.car.name} ({self.get_rental_type_display()})"


class Payment(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]
    
    rental = models.ForeignKey(Rental, on_delete=models.CASCADE, related_name='payments')
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_session_id = models.CharField(max_length=255, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_reference = models.CharField(max_length=50, unique=True, blank=True)
    payment_type = models.CharField(max_length=50, default='weekly')
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    payment_date = models.DateTimeField(auto_now_add=True)
    payment_for_week = models.IntegerField(default=0)
    notes = models.TextField(blank=True, default='')
    
    def save(self, *args, **kwargs):
        if not self.payment_reference:
            import uuid
            self.payment_reference = f"PMT-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Payment {self.payment_reference} - ${self.amount} - {self.status}"


class CarAvailability(models.Model):
    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name='availabilities')
    date = models.DateField()
    available_units = models.IntegerField(default=1)
    is_fully_booked = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['car', 'date']
    
    def __str__(self):
        return f"{self.car.name} - {self.date}: {self.available_units} available"


class ContactMessage(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()
    subject = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.name} - {self.subject}"


class Vehicle(models.Model):
    plate_number = models.CharField(max_length=20, unique=True)
    vin_number = models.CharField(max_length=50, blank=True, null=True)
    engine_number = models.CharField(max_length=50, blank=True, null=True)
    registration_date = models.DateField(blank=True, null=True)
    registration_expiry = models.DateField(blank=True, null=True)
    colour = models.CharField(max_length=50, blank=True, null=True)
    year = models.IntegerField(blank=True, null=True)
    manufacturer = models.CharField(max_length=100, blank=True, null=True)
    model = models.CharField(max_length=100, blank=True, null=True)
    seller = models.CharField(max_length=200, blank=True, null=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    purchase_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50, default='active')

    current_odometer = models.IntegerField(default=0, help_text="Current odometer reading in kilometers")
    last_service_odometer = models.IntegerField(default=0, help_text="Odometer reading at last service")
    service_interval_km = models.IntegerField(default=10000, help_text="Service interval in kilometers")
    next_service_odometer = models.IntegerField(default=10000, help_text="Next service due at this odometer reading")
    last_service_date = models.DateField(blank=True, null=True)
    next_service_date = models.DateField(blank=True, null=True)
    service_status = models.CharField(max_length=50, default='ok', choices=[
        ('ok', 'OK'),
        ('due_soon', 'Due Soon'),
        ('due_now', 'Due Now'),
        ('overdue', 'Overdue'),
    ])
    
    def update_service_status(self):
        """Update service status based on current odometer"""
        if self.current_odometer >= self.next_service_odometer:
            self.service_status = 'due_now'
        elif self.current_odometer >= self.next_service_odometer - 2000:
            self.service_status = 'due_soon'
        elif self.current_odometer > self.next_service_odometer + 5000:
            self.service_status = 'overdue'
        else:
            self.service_status = 'ok'
        self.save(update_fields=['service_status'])
    
    def __str__(self):
        return f"{self.plate_number} - {self.manufacturer} {self.model}"
    
    @property
    def is_registration_expiring_soon(self):
        if self.registration_expiry:
            days_left = (self.registration_expiry - date.today()).days
            return days_left <= 30
        return False


@receiver(post_save, sender=Car)
def create_vehicle_from_car(sender, instance, created, **kwargs):
    """Auto-create or update Vehicle record when a Car is created/updated"""
    try:
        plate_number = f"CAR-{instance.id}"
        
        vehicle, vehicle_created = Vehicle.objects.get_or_create(
            plate_number=plate_number,
            defaults={
                'manufacturer': instance.brand,
                'model': instance.name,
                'year': instance.model_year,
                'status': 'active',
                'purchase_price': instance.car_value or 0,
            }
        )
        
        if not vehicle_created:
            vehicle.manufacturer = instance.brand
            vehicle.model = instance.name
            vehicle.year = instance.model_year
            vehicle.status = instance.status if instance.status in ['active', 'maintenance', 'decommissioned'] else 'active'
            vehicle.purchase_price = instance.car_value or 0
            vehicle.save()
        
        if instance.status == 'available':
            vehicle.status = 'active'
        elif instance.status == 'rented':
            vehicle.status = 'rented'
        elif instance.status == 'maintenance':
            vehicle.status = 'maintenance'
        vehicle.save()
        
    except Exception as e:
        print(f"Error creating vehicle from car: {e}")


@receiver(post_delete, sender=Car)
def delete_vehicle_when_car_deleted(sender, instance, **kwargs):
    """Delete corresponding Vehicle when Car is deleted"""
    try:
        plate_number = f"CAR-{instance.id}"
        vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
        if vehicle:
            vehicle.delete()
    except Exception as e:
        print(f"Error deleting vehicle: {e}")


class Driver(models.Model):
    plate_number = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='drivers', null=True, blank=True)
    name = models.CharField(max_length=200)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    driver_licence_no = models.CharField(max_length=50, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    email_address = models.EmailField(blank=True, null=True)
    toll_notice_form = models.CharField(max_length=50, blank=True, null=True)
    is_current = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.name} - {self.plate_number}"


@receiver(post_save, sender=Rental)
def create_driver_from_rental(sender, instance, created, **kwargs):
    if created:
        existing_driver = None
        if instance.customer_email:
            existing_driver = Driver.objects.filter(email_address=instance.customer_email).first()
        if not existing_driver and instance.customer_phone:
            existing_driver = Driver.objects.filter(phone_number=instance.customer_phone).first()
        
        if not existing_driver:
            driver = Driver.objects.create(
                name=instance.customer_name,
                phone_number=instance.customer_phone,
                email_address=instance.customer_email,
                start_date=instance.start_date.date() if instance.start_date else None,
                end_date=instance.end_date.date() if instance.end_date else None,
                is_current=(instance.status == 'active'),
            )
        else:
            if instance.start_date and (not existing_driver.start_date or instance.start_date.date() < existing_driver.start_date):
                existing_driver.start_date = instance.start_date.date()
            if instance.end_date and (not existing_driver.end_date or instance.end_date.date() > existing_driver.end_date):
                existing_driver.end_date = instance.end_date.date()
            if instance.status == 'active':
                existing_driver.is_current = True
            existing_driver.save()


class Insurance(models.Model):
    plate_number = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='insurances')
    policy_holder = models.CharField(max_length=200, blank=True, null=True)
    policy_number = models.CharField(max_length=100, blank=True, null=True)
    provider = models.CharField(max_length=100, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    monthly_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    excess_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    account_email = models.EmailField(blank=True, null=True)
    password = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=50, default='active')
    
    def __str__(self):
        return f"{self.plate_number} - {self.provider}"
    
    @property
    def is_expiring_soon(self):
        if self.end_date:
            days_left = (self.end_date - date.today()).days
            return days_left <= 30
        return False


class GPSDevice(models.Model):
    plate_number = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='gps_devices')
    account_name = models.CharField(max_length=200, blank=True, null=True)
    activation_date = models.DateField(blank=True, null=True)
    old_sim_no = models.CharField(max_length=50, blank=True, null=True)
    new_sim_no = models.CharField(max_length=50, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    old_tracker_no = models.CharField(max_length=50, blank=True, null=True)
    new_tracker_no = models.CharField(max_length=50, blank=True, null=True)
    email_address = models.EmailField(blank=True, null=True)
    password = models.CharField(max_length=100, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    provider = models.CharField(max_length=50, default='Seeworld WhatsGPS')
    
    def __str__(self):
        return f"{self.plate_number} - {self.new_tracker_no}"


class ServiceRecord(models.Model):
    plate_number = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='services')
    driver_name = models.CharField(max_length=200, blank=True, null=True)
    current_reading = models.IntegerField(default=0)
    next_service_at = models.IntegerField(default=0)
    schedule_service = models.CharField(max_length=200, blank=True, null=True)
    completed_on = models.DateField(blank=True, null=True)
    forecasted_service = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    done_at = models.CharField(max_length=200, blank=True, null=True)
    
    def __str__(self):
        return f"{self.plate_number} - Service at {self.next_service_at}km"
    
    @property
    def is_service_due(self):
        return self.current_reading >= self.next_service_at if self.next_service_at else False


class TollOffence(models.Model):
    penalty_notice_number = models.CharField(max_length=50, unique=True)
    offence = models.TextField()
    location = models.CharField(max_length=200, blank=True, null=True)
    vehicle_rego = models.CharField(max_length=20)
    offence_date = models.DateField()
    maturity_date = models.DateField(blank=True, null=True)
    driver_name = models.CharField(max_length=200, blank=True, null=True)
    driver_licence_no = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=50, default='outstanding')
    overdue_fine_number = models.CharField(max_length=50, blank=True, null=True)
    mail_date = models.DateField(blank=True, null=True)
    submitted = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.penalty_notice_number} - {self.vehicle_rego}"
    
    @property
    def is_overdue(self):
        if self.maturity_date:
            return date.today() > self.maturity_date
        return False


class PaymentLedger(models.Model):
    plate_number = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='payment_ledgers')
    driver_name = models.CharField(max_length=200)
    week_start = models.DateField()
    week_end = models.DateField()
    due_date = models.DateField()
    due_amount = models.DecimalField(max_digits=10, decimal_places=2)
    received_date = models.DateField(blank=True, null=True)
    received_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    late_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=50, default='pending')
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['due_date']
    
    def __str__(self):
        return f"{self.plate_number} - Week {self.week_start} to {self.week_end}"
    
    @property
    def is_late(self):
        return date.today() > self.due_date and self.status != 'paid'


class IncomeExpense(models.Model):
    TYPE_CHOICES = [
        ('income', 'Income'),
        ('expense', 'Expense'),
    ]
    
    CATEGORY_CHOICES = [
        ('rental', 'Rental Income'),
        ('insurance', 'Insurance'),
        ('maintenance', 'Maintenance'),
        ('registration', 'Registration'),
        ('fuel', 'Fuel'),
        ('toll', 'Toll'),
        ('other', 'Other'),
    ]
    
    plate_number = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='transactions', null=True, blank=True)
    date = models.DateField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=200)
    reference = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.date} - {self.type} - ${self.amount}"


class InstallStatus(models.Model):
    plate_number = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='install_status')
    driver_name = models.CharField(max_length=200)
    tracker_number = models.CharField(max_length=50, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    sim_brand = models.CharField(max_length=50, blank=True, null=True)
    invoice_number = models.CharField(max_length=50, blank=True, null=True)
    install_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50, default='pending')
    notes = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"{self.plate_number} - {self.driver_name}"


class Claim(models.Model):
    vehicle_rego = models.CharField(max_length=20)
    claim_number = models.CharField(max_length=50, unique=True)
    coverage = models.CharField(max_length=200, blank=True, null=True)
    event_date = models.DateField()
    what_happened = models.TextField()
    progress = models.CharField(max_length=50, default='in_progress')
    incident_location = models.CharField(max_length=200, blank=True, null=True)
    excess = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    repair_details = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.claim_number} - {self.vehicle_rego}"


# ==================== CASCADE DELETION SIGNALS ====================

@receiver(pre_delete, sender=Rental)
def delete_related_payment_ledger(sender, instance, **kwargs):
    """Delete PaymentLedger entries when rental is deleted"""
    try:
        vehicle = None
        if instance.car:
            plate_number = f"CAR-{instance.car.id}"
            vehicle = Vehicle.objects.filter(plate_number=plate_number).first()
        
        if vehicle:
            PaymentLedger.objects.filter(
                plate_number=vehicle,
                driver_name=instance.customer_name
            ).delete()
            print(f"Deleted PaymentLedger entries for rental {instance.booking_reference}")
    except Exception as e:
        print(f"Error deleting PaymentLedger: {e}")


@receiver(pre_delete, sender=Payment)
def delete_income_expense_on_payment_delete(sender, instance, **kwargs):
    """Delete IncomeExpense record when payment is deleted"""
    try:
        IncomeExpense.objects.filter(reference=instance.payment_reference).delete()
        print(f"Deleted IncomeExpense record for payment {instance.payment_reference}")
    except Exception as e:
        print(f"Error deleting IncomeExpense: {e}")


@receiver(pre_delete, sender=Rental)
def delete_all_rental_related_records(sender, instance, **kwargs):
    """Delete all related payments and their income records when rental is deleted"""
    try:
        payments = Payment.objects.filter(rental=instance)
        payment_count = payments.count()
        
        for payment in payments:
            IncomeExpense.objects.filter(reference=payment.payment_reference).delete()
        
        payments.delete()
        
        print(f"Deleted {payment_count} payments and their income records for rental {instance.booking_reference}")
    except Exception as e:
        print(f"Error deleting rental related records: {e}")