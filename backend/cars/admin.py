# backend/cars/admin.py - Complete fixed version

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Count, Sum, Q
from unfold.admin import ModelAdmin, StackedInline, TabularInline
from .models import *
from datetime import date, timedelta


class UserProfileInline(StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'


class CustomUserAdmin(ModelAdmin, UserAdmin):
    inlines = (UserProfileInline,)
    list_display = ['username', 'email', 'first_name', 'last_name', 'is_staff', 'get_user_type', 'get_phone', 'is_verified']
    list_filter = ['is_staff', 'is_superuser', 'is_active', 'profile__user_type', 'profile__is_verified']
    search_fields = ['username', 'email', 'first_name', 'last_name', 'profile__phone', 'profile__business_name']
    
    def get_user_type(self, obj):
        return obj.profile.user_type if hasattr(obj, 'profile') else 'N/A'
    get_user_type.short_description = 'User Type'
    
    def get_phone(self, obj):
        return obj.profile.phone if hasattr(obj, 'profile') else 'N/A'
    get_phone.short_description = 'Phone'
    
    def is_verified(self, obj):
        return obj.profile.is_verified if hasattr(obj, 'profile') else False
    is_verified.boolean = True
    is_verified.short_description = 'Verified'


admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)


@admin.register(UserProfile)
class UserProfileAdmin(ModelAdmin):
    list_display = ['user', 'full_name', 'phone', 'user_type', 'business_name', 'is_verified', 'created_at']
    list_filter = ['user_type', 'is_verified', 'country', 'state']
    search_fields = ['user__username', 'user__email', 'phone', 'business_name', 'abn']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('User Information', {
            'fields': ('user', 'user_type', 'is_verified')
        }),
        ('Personal Details', {
            'fields': ('phone', 'address', 'city', 'state', 'country', 'postal_code')
        }),
        ('Business Information', {
            'fields': ('business_name', 'abn'),
            'classes': ('collapse',)
        }),
        ('Profile Picture', {
            'fields': ('profile_picture',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


class CarImageInline(TabularInline):
    model = CarImage
    extra = 3
    fields = ['image', 'image_url', 'is_primary', 'preview']
    readonly_fields = ['preview']
    
    def preview(self, obj):
        if obj.image_url:
            return format_html('<img src="{}" width="100" height="100" style="object-fit: cover;" />', obj.image_url)
        elif obj.image:
            return format_html('<img src="{}" width="100" height="100" style="object-fit: cover;" />', obj.image.url)
        return "No Image"
    preview.short_description = 'Preview'


@admin.register(Car)
class CarAdmin(ModelAdmin):
    list_display = ['id', 'name', 'brand', 'model_year', 'owner_name', 'daily_price', 'weekly_price', 'signup_fee', 'bond_amount', 'status', 'featured', 'available_units_display']
    list_filter = ['status', 'fuel_type', 'transmission', 'featured', 'short_term_available', 'long_term_available', 'rent_to_own_available']
    search_fields = ['name', 'brand', 'description', 'owner__username', 'owner__email']
    inlines = [CarImageInline]
    readonly_fields = ['created_at', 'updated_at', 'calculate_weekly_payment_preview']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'brand', 'model_year', 'owner', 'status', 'featured')
        }),
        ('Rental Options Availability', {
            'fields': ('short_term_available', 'long_term_available', 'rent_to_own_available'),
            'description': 'Enable/disable rental options for this vehicle'
        }),
        ('Pricing', {
            'fields': ('daily_price', 'weekly_price', 'rent_to_own_price'),
            'description': 'Set rental prices'
        }),
        ('Signup Fee', {
            'fields': ('signup_fee', 'signup_fee_description'),
            'description': 'Signup fee paid upfront to book the car (non-refundable)',
            'classes': ('wide',),
        }),
        ('Car Valuation & Rent-to-Own', {
            'fields': ('car_value', 'rent_to_own_years', 'rent_to_own_term'),
            'description': 'Car value and rent-to-own terms (3-7 years)'
        }),
        ('Rent-to-Own Calculation Parameters', {
            'fields': ('interest_rate', 'ongoing_cost_weekly', 'service_fee_weekly'),
            'description': 'Excel formula based calculation: Total Cost = Car Value + (Interest% × Car Value × Years) + (Ongoing Cost × Total Weeks) + (Service Fee × Total Weeks)'
        }),
        ('Weekly Payment Preview', {
            'fields': ('calculate_weekly_payment_preview',),
            'description': 'Preview calculated weekly payment based on current settings'
        }),
        ('Bond Settings', {
            'fields': ('bond_amount', 'bond_refundable', 'bond_terms'),
            'classes': ('wide',),
            'description': 'Optional refundable bond amount for this vehicle (paid after signup)'
        }),
        ('Stock & Availability', {
            'fields': ('total_units', 'available_units', 'min_rental_days', 'max_weekly_bookings'),
            'description': 'Inventory and booking limits'
        }),
        ('Specifications', {
            'fields': ('fuel_type', 'transmission', 'seats', 'luggage_capacity')
        }),
        ('Description & Features', {
            'fields': ('description', 'features'),
            'classes': ('wide',),
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    def owner_name(self, obj):
        return obj.owner.username if obj.owner else 'No Owner'
    owner_name.short_description = 'Owner'
    
    def available_units_display(self, obj):
        return f"{obj.available_units}/{obj.total_units}"
    available_units_display.short_description = 'Available Units'
    
    def calculate_weekly_payment_preview(self, obj):
        if obj.car_value and obj.car_value > 0:
            weekly_payment, total_weeks, total_cost = obj.calculate_rent_to_own_weekly()
            return format_html(
                '<div style="background: #f0f8ff; padding: 10px; border-radius: 5px;">'
                '<strong>Weekly Payment:</strong> ${}<br>'
                '<strong>Total Weeks:</strong> {}<br>'
                '<strong>Total Contract Value:</strong> ${}<br>'
                '<small>Based on: Car Value ${}, Interest {}%, Ongoing Cost ${}/week, Service Fee ${}/week</small>'
                '</div>',
                weekly_payment, total_weeks, total_cost,
                obj.car_value, float(obj.interest_rate) * 100, obj.ongoing_cost_weekly, obj.service_fee_weekly
            )
        return "Set car value to calculate payment"
    calculate_weekly_payment_preview.short_description = 'Weekly Payment Preview'


@admin.register(CarImage)
class CarImageAdmin(ModelAdmin):
    list_display = ['id', 'car', 'is_primary', 'has_cloudinary_url', 'image_preview', 'uploaded_at']
    list_filter = ['car', 'is_primary']
    search_fields = ['car__name', 'car__brand', 'public_id']
    readonly_fields = ['uploaded_at']
    
    def has_cloudinary_url(self, obj):
        return bool(obj.image_url)
    has_cloudinary_url.boolean = True
    has_cloudinary_url.short_description = 'Has Cloudinary URL'
    
    def image_preview(self, obj):
        if obj.image_url:
            return format_html('<img src="{}" width="50" height="50" style="object-fit: cover; border-radius: 4px;" />', obj.image_url)
        elif obj.image:
            return format_html('<img src="{}" width="50" height="50" style="object-fit: cover; border-radius: 4px;" />', obj.image.url)
        return "No Image"
    image_preview.short_description = 'Preview'


@admin.register(Rental)
class RentalAdmin(ModelAdmin):
    list_display = ['booking_reference', 'customer_name', 'car_link', 'rental_type', 'start_date', 'end_date', 'total_price', 'signup_fee_paid', 'bond_paid', 'status']
    list_filter = ['status', 'rental_type', 'start_date', 'signup_fee_paid', 'bond_paid', 'bond_refunded']
    search_fields = ['customer_name', 'customer_email', 'booking_reference', 'car__name', 'car__brand']
    readonly_fields = ['booking_reference', 'created_at']
    
    fieldsets = (
        ('Booking Information', {
            'fields': ('booking_reference', 'car', 'renter', 'rental_type', 'status')
        }),
        ('Customer Details', {
            'fields': ('customer_name', 'customer_email', 'customer_phone')
        }),
        ('Rental Period', {
            'fields': ('start_date', 'end_date', 'days', 'weeks', 'months')
        }),
        ('Pricing', {
            'fields': ('weekly_price', 'total_price')
        }),
        ('Signup Fee Information', {
            'fields': ('signup_fee_amount', 'signup_fee_paid'),
            'classes': ('wide',),
            'description': 'Signup fee paid at booking (non-refundable)'
        }),
        ('Bond Information', {
            'fields': ('bond_amount', 'bond_paid', 'bond_refunded', 'bond_refund_date', 'bond_payment_id'),
            'classes': ('wide',),
            'description': 'Bond payment tracking - refundable upon vehicle return (paid after signup)'
        }),
        ('Additional Information', {
            'fields': ('special_requests', 'created_at', 'stripe_session_id'),
            'classes': ('collapse',),
        }),
    )
    
    def car_link(self, obj):
        if obj.car:
            return format_html('<a href="/admin/cars/car/{}/change/">{}</a>', obj.car.id, obj.car.name)
        return '-'
    car_link.short_description = 'Car'


@admin.register(Payment)
class PaymentAdmin(ModelAdmin):
    list_display = ['payment_reference', 'rental_link', 'amount', 'status', 'payment_type', 'payment_for_week', 'payment_date']
    list_filter = ['status', 'payment_type', 'payment_date']
    search_fields = ['payment_reference', 'rental__booking_reference', 'rental__customer_name']
    readonly_fields = ['payment_date', 'payment_reference']
    
    fieldsets = (
        ('Payment Information', {
            'fields': ('payment_reference', 'rental', 'amount', 'payment_type', 'status')
        }),
        ('Payment Details', {
            'fields': ('payment_for_week', 'notes', 'payment_date')
        }),
        ('Stripe Information', {
            'fields': ('stripe_payment_intent_id', 'stripe_session_id'),
            'classes': ('collapse',),
        }),
    )
    
    def rental_link(self, obj):
        if obj.rental:
            return format_html('<a href="/admin/cars/rental/{}/change/">{}</a>', obj.rental.id, obj.rental.booking_reference)
        return '-'
    rental_link.short_description = 'Rental'


@admin.register(CarAvailability)
class CarAvailabilityAdmin(ModelAdmin):
    list_display = ['car', 'date', 'available_units', 'is_fully_booked']
    list_filter = ['is_fully_booked', 'date']
    search_fields = ['car__name', 'car__brand']
    readonly_fields = []
    
    fieldsets = (
        ('Availability Information', {
            'fields': ('car', 'date', 'available_units', 'is_fully_booked')
        }),
    )


@admin.register(ContactMessage)
class ContactMessageAdmin(ModelAdmin):
    list_display = ['name', 'email', 'subject', 'is_read', 'created_at']
    list_filter = ['is_read', 'created_at']
    search_fields = ['name', 'email', 'subject', 'message']
    readonly_fields = ['created_at']
    
    actions = ['mark_as_read', 'mark_as_unread']
    
    def mark_as_read(self, request, queryset):
        queryset.update(is_read=True)
    mark_as_read.short_description = 'Mark selected messages as read'
    
    def mark_as_unread(self, request, queryset):
        queryset.update(is_read=False)
    mark_as_unread.short_description = 'Mark selected messages as unread'


@admin.register(Vehicle)
class VehicleAdmin(ModelAdmin):
    list_display = ['plate_number', 'manufacturer', 'model', 'year', 'colour', 'registration_expiry', 'status', 'expiry_warning']
    list_filter = ['status', 'manufacturer', 'year']
    search_fields = ['plate_number', 'vin_number', 'engine_number', 'manufacturer', 'model', 'seller']
    readonly_fields = ['get_related_info']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('plate_number', 'vin_number', 'engine_number', 'colour', 'year', 'manufacturer', 'model')
        }),
        ('Registration', {
            'fields': ('registration_date', 'registration_expiry', 'seller')
        }),
        ('Purchase', {
            'fields': ('purchase_price', 'purchase_date')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Related Information', {
            'fields': ('get_related_info',),
            'classes': ('collapse',),
        }),
    )
    
    def expiry_warning(self, obj):
        if obj.registration_expiry:
            days_left = (obj.registration_expiry - date.today()).days
            if days_left <= 30:
                color = 'red' if days_left <= 7 else 'orange'
                return format_html('<span style="color: {}; font-weight: bold;">Expires in {} days</span>', color, days_left)
        return 'Current'
    expiry_warning.short_description = 'Rego Status'
    
    def get_related_info(self, obj):
        drivers = obj.drivers.filter(is_current=True)
        current_driver = drivers.first()
        
        return format_html('''
        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
            <h4>Current Driver: {}</h4>
            <p><strong>Phone:</strong> {}<br>
            <strong>Email:</strong> {}</p>
            <hr>
            <h4>Insurance:</h4>
            <p>{}</p>
            <hr>
            <h4>GPS Tracker:</h4>
            <p>{}</p>
        </div>
        ''',
            current_driver.name if current_driver else 'No current driver',
            current_driver.phone_number if current_driver else 'N/A',
            current_driver.email_address if current_driver else 'N/A',
            '<br>'.join([f"{i.provider}: {i.policy_number} (Expires: {i.end_date})" for i in obj.insurances.filter(status='active')[:2]]) or 'No active insurance',
            '<br>'.join([f"Tracker: {g.new_tracker_no} - SIM: {g.new_sim_no}" for g in obj.gps_devices.all()[:2]]) or 'No GPS device'
        )
    get_related_info.short_description = 'Vehicle Information'
    get_related_info.allow_tags = True


@admin.register(Driver)
class DriverAdmin(ModelAdmin):
    list_display = ['name', 'plate_number_link', 'phone_number', 'start_date', 'end_date', 'is_current', 'payment_status']
    list_filter = ['is_current', 'plate_number']
    search_fields = ['name', 'driver_licence_no', 'phone_number', 'email_address']
    
    fieldsets = (
        ('Driver Information', {
            'fields': ('name', 'plate_number', 'driver_licence_no', 'date_of_birth')
        }),
        ('Contact', {
            'fields': ('phone_number', 'email_address', 'address')
        }),
        ('Rental Period', {
            'fields': ('start_date', 'end_date', 'toll_notice_form', 'is_current')
        }),
    )
    
    def plate_number_link(self, obj):
        if obj.plate_number:
            return format_html('<a href="/admin/cars/vehicle/{}/change/">{}</a>', obj.plate_number.id, obj.plate_number.plate_number)
        return '-'
    plate_number_link.short_description = 'Plate Number'
    
    def payment_status(self, obj):
        pending_count = PaymentLedger.objects.filter(
            plate_number=obj.plate_number, 
            status='pending'
        ).count()
        
        if pending_count > 0:
            return format_html('<span style="color: red;">{} pending payments</span>', pending_count)
        return format_html('<span style="color: green;">Up to date</span>')
    payment_status.short_description = 'Payment Status'


@admin.register(Insurance)
class InsuranceAdmin(ModelAdmin):
    list_display = ['plate_number_link', 'provider', 'policy_number', 'monthly_amount', 'end_date', 'status', 'expiry_status']
    list_filter = ['provider', 'status']
    search_fields = ['plate_number__plate_number', 'policy_number', 'policy_holder']
    
    fieldsets = (
        ('Policy Details', {
            'fields': ('plate_number', 'policy_number', 'provider', 'status')
        }),
        ('Holder Information', {
            'fields': ('policy_holder', 'account_email', 'password')
        }),
        ('Dates & Amounts', {
            'fields': ('start_date', 'end_date', 'monthly_amount', 'excess_fee')
        }),
    )
    
    def plate_number_link(self, obj):
        if obj.plate_number:
            return format_html('<a href="/admin/cars/vehicle/{}/change/">{}</a>', obj.plate_number.id, obj.plate_number.plate_number)
        return '-'
    plate_number_link.short_description = 'Plate Number'
    
    def expiry_status(self, obj):
        if obj.end_date:
            days_left = (obj.end_date - date.today()).days
            if days_left <= 30:
                return format_html('<span style="color: red;">Expires in {} days</span>', days_left)
        return 'Active'
    expiry_status.short_description = 'Expiry Status'


@admin.register(GPSDevice)
class GPSDeviceAdmin(ModelAdmin):
    list_display = ['plate_number_link', 'new_tracker_no', 'new_sim_no', 'activation_date', 'provider']
    list_filter = ['provider']
    search_fields = ['plate_number__plate_number', 'new_tracker_no', 'new_sim_no', 'account_name']
    
    fieldsets = (
        ('Device Information', {
            'fields': ('plate_number', 'new_tracker_no', 'new_sim_no', 'old_tracker_no', 'old_sim_no')
        }),
        ('Account Details', {
            'fields': ('account_name', 'phone_number', 'email_address', 'password', 'date_of_birth')
        }),
        ('Activation', {
            'fields': ('activation_date', 'provider')
        }),
    )
    
    def plate_number_link(self, obj):
        if obj.plate_number:
            return format_html('<a href="/admin/cars/vehicle/{}/change/">{}</a>', obj.plate_number.id, obj.plate_number.plate_number)
        return '-'
    plate_number_link.short_description = 'Plate Number'


@admin.register(ServiceRecord)
class ServiceRecordAdmin(ModelAdmin):
    list_display = ['plate_number_link', 'driver_name', 'current_reading', 'next_service_at', 'service_status', 'forecasted_service', 'completed_on']
    list_filter = ['status', 'completed_on']
    search_fields = ['plate_number__plate_number', 'driver_name', 'notes']
    
    def plate_number_link(self, obj):
        if obj.plate_number:
            return format_html('<a href="/admin/cars/vehicle/{}/change/">{}</a>', obj.plate_number.id, obj.plate_number.plate_number)
        return '-'
    plate_number_link.short_description = 'Plate Number'
    
    def service_status(self, obj):
        if obj.current_reading >= obj.next_service_at:
            return format_html('<span style="color: red; font-weight: bold;">DUE NOW</span>')
        elif obj.next_service_at - obj.current_reading <= 5000:
            return format_html('<span style="color: orange;">Due Soon</span>')
        return 'OK'
    service_status.short_description = 'Status'


@admin.register(TollOffence)
class TollOffenceAdmin(ModelAdmin):
    list_display = ['penalty_notice_number', 'vehicle_rego', 'driver_name', 'offence_date', 'maturity_date', 'status', 'overdue_status', 'submitted']
    list_filter = ['status', 'offence_date', 'submitted']
    search_fields = ['penalty_notice_number', 'vehicle_rego', 'driver_name', 'offence']
    readonly_fields = ['is_overdue']
    
    fieldsets = (
        ('Offence Information', {
            'fields': ('penalty_notice_number', 'offence', 'location', 'vehicle_rego')
        }),
        ('Dates', {
            'fields': ('offence_date', 'maturity_date', 'mail_date')
        }),
        ('Driver Information', {
            'fields': ('driver_name', 'driver_licence_no')
        }),
        ('Status', {
            'fields': ('status', 'overdue_fine_number', 'submitted')
        }),
    )
    
    def overdue_status(self, obj):
        if obj.maturity_date and date.today() > obj.maturity_date and obj.status == 'outstanding':
            return format_html('<span style="color: red;">OVERDUE</span>')
        return 'Current'
    overdue_status.short_description = 'Overdue'


@admin.register(PaymentLedger)
class PaymentLedgerAdmin(ModelAdmin):
    list_display = ['plate_number_link', 'driver_name', 'week_start', 'week_end', 'due_date', 'due_amount', 'received_amount', 'status', 'payment_status']
    list_filter = ['status', 'due_date']
    search_fields = ['plate_number__plate_number', 'driver_name']
    
    fieldsets = (
        ('Payment Information', {
            'fields': ('plate_number', 'driver_name')
        }),
        ('Period', {
            'fields': ('week_start', 'week_end', 'due_date')
        }),
        ('Amounts', {
            'fields': ('due_amount', 'received_amount', 'late_fee')
        }),
        ('Status', {
            'fields': ('status', 'notes', 'received_date')
        }),
    )
    
    def plate_number_link(self, obj):
        if obj.plate_number:
            return format_html('<a href="/admin/cars/vehicle/{}/change/">{}</a>', obj.plate_number.id, obj.plate_number.plate_number)
        return '-'
    plate_number_link.short_description = 'Plate Number'
    
    def payment_status(self, obj):
        if obj.status == 'paid':
            return format_html('<span style="color: green;">✓ Paid</span>')
        elif obj.due_date < date.today():
            return format_html('<span style="color: red;">Late - ${}</span>', obj.due_amount - obj.received_amount)
        return format_html('<span style="color: orange;">Pending - ${}</span>', obj.due_amount - obj.received_amount)
    payment_status.short_description = 'Status'


@admin.register(IncomeExpense)
class IncomeExpenseAdmin(ModelAdmin):
    list_display = ['date', 'plate_number_link', 'type', 'category', 'amount', 'description']
    list_filter = ['type', 'category', 'date']
    search_fields = ['description', 'reference', 'plate_number__plate_number']
    
    fieldsets = (
        ('Transaction Information', {
            'fields': ('date', 'type', 'category', 'amount', 'description')
        }),
        ('Reference', {
            'fields': ('reference', 'plate_number')
        }),
    )
    
    def plate_number_link(self, obj):
        if obj.plate_number:
            return format_html('<a href="/admin/cars/vehicle/{}/change/">{}</a>', obj.plate_number.id, obj.plate_number.plate_number)
        return '-'
    plate_number_link.short_description = 'Plate Number'


@admin.register(InstallStatus)
class InstallStatusAdmin(ModelAdmin):
    list_display = ['plate_number_link', 'driver_name', 'tracker_number', 'install_date', 'status']
    list_filter = ['status', 'install_date']
    search_fields = ['plate_number__plate_number', 'driver_name', 'tracker_number', 'invoice_number']
    
    def plate_number_link(self, obj):
        if obj.plate_number:
            return format_html('<a href="/admin/cars/vehicle/{}/change/">{}</a>', obj.plate_number.id, obj.plate_number.plate_number)
        return '-'
    plate_number_link.short_description = 'Plate Number'


@admin.register(Claim)
class ClaimAdmin(ModelAdmin):
    list_display = ['claim_number', 'vehicle_rego', 'event_date', 'progress', 'excess', 'created_at']
    list_filter = ['progress', 'event_date']
    search_fields = ['claim_number', 'vehicle_rego', 'what_happened']
    
    fieldsets = (
        ('Claim Information', {
            'fields': ('claim_number', 'vehicle_rego', 'coverage', 'progress')
        }),
        ('Incident Details', {
            'fields': ('event_date', 'what_happened', 'incident_location')
        }),
        ('Financial', {
            'fields': ('excess', 'repair_details')
        }),
    )


# Dashboard Widget for Admin Index
class DashboardStats:
    @staticmethod
    def get_stats():
        today = date.today()
        
        return {
            'vehicles': {
                'total': Vehicle.objects.count(),
                'active': Vehicle.objects.filter(status='active').count(),
                'expiring_rego': Vehicle.objects.filter(
                    registration_expiry__gte=today,
                    registration_expiry__lte=today + timedelta(days=30)
                ).count(),
            },
            'drivers': {
                'active': Driver.objects.filter(is_current=True).count(),
                'total': Driver.objects.count(),
            },
            'payments': {
                'pending': PaymentLedger.objects.filter(status='pending').count(),
                'overdue': PaymentLedger.objects.filter(
                    status='pending', 
                    due_date__lt=today
                ).count(),
                'total_due': PaymentLedger.objects.filter(status='pending').aggregate(
                    total=Sum('due_amount')
                )['total'] or 0,
            },
            'services': {
                'due': ServiceRecord.objects.filter(
                    current_reading__gte=models.F('next_service_at')
                ).count(),
                'due_soon': ServiceRecord.objects.filter(
                    next_service_at__gt=models.F('current_reading'),
                    next_service_at__lte=models.F('current_reading') + 5000
                ).count(),
            },
            'offences': {
                'outstanding': TollOffence.objects.filter(status='outstanding').count(),
                'overdue': TollOffence.objects.filter(
                    status='outstanding',
                    maturity_date__lt=today
                ).count(),
            },
            'insurance': {
                'expiring': Insurance.objects.filter(
                    status='active',
                    end_date__gte=today,
                    end_date__lte=today + timedelta(days=30)
                ).count(),
            },
            'cars': {
                'total': Car.objects.count(),
                'available': Car.objects.filter(status='available').count(),
                'rented': Car.objects.filter(status='rented').count(),
            },
            'rentals': {
                'active': Rental.objects.filter(status='active').count(),
                'pending': Rental.objects.filter(status='pending').count(),
                'total_revenue': Rental.objects.filter(
                    status__in=['confirmed', 'active', 'completed']
                ).aggregate(total=Sum('total_price'))['total'] or 0,
            }
        }

