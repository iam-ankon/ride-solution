import os
import django
from decimal import Decimal
from django.core.files import File

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ridesolutions.settings')
django.setup()

from cars.models import Car, CarImage
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
import shutil

# Complete car data with all specifications
CAR_DATA = [
    {
        'name': 'C5',
        'brand': 'Chery',
        'model_year': 2024,
        'daily_price': 45.00,
        'weekly_price': 280.00,
        'rent_to_own_price': 18500.00,
        'rent_to_own_term': 48,
        'min_rental_days': 1,
        'total_units': 3,
        'available_units': 3,
        'max_weekly_bookings': 5,
        'fuel_type': 'Petrol',
        'transmission': 'Automatic',
        'seats': 5,
        'luggage_capacity': 3,
        'description': 'The Chery C5 is a stylish and fuel-efficient sedan perfect for daily commuting and business trips. Features include a modern infotainment system, comfortable seating, and excellent fuel economy.',
        'features': '• 8-inch Touchscreen Display\n• Apple CarPlay & Android Auto\n• Reverse Camera\n• Cruise Control\n• Bluetooth Connectivity\n• Keyless Entry\n• LED Headlights\n• 17-inch Alloy Wheels',
        'status': 'available',
        'featured': True
    },
    {
        'name': 'Tiggo 4',
        'brand': 'Chery',
        'model_year': 2024,
        'daily_price': 55.00,
        'weekly_price': 340.00,
        'rent_to_own_price': 22500.00,
        'rent_to_own_term': 48,
        'min_rental_days': 1,
        'total_units': 4,
        'available_units': 4,
        'max_weekly_bookings': 6,
        'fuel_type': 'Petrol',
        'transmission': 'Automatic',
        'seats': 5,
        'luggage_capacity': 4,
        'description': 'The Chery Tiggo 4 is a compact SUV that combines style, comfort, and practicality. Perfect for city driving and weekend getaways with ample cargo space.',
        'features': '• 10.25-inch Touchscreen\n• Panoramic Sunroof\n• 360° Camera\n• Wireless Charging\n• Heated Seats\n• Push Button Start\n• LED Daytime Running Lights\n• 18-inch Alloy Wheels',
        'status': 'available',
        'featured': True
    },
    {
        'name': 'Sealion 6',
        'brand': 'BYD',
        'model_year': 2024,
        'daily_price': 75.00,
        'weekly_price': 470.00,
        'rent_to_own_price': 32500.00,
        'rent_to_own_term': 60,
        'min_rental_days': 1,
        'total_units': 2,
        'available_units': 2,
        'max_weekly_bookings': 4,
        'fuel_type': 'Hybrid',
        'transmission': 'Automatic',
        'seats': 5,
        'luggage_capacity': 5,
        'description': 'The BYD Sealion 6 is a premium hybrid SUV offering exceptional fuel efficiency and modern design. Advanced safety features and luxurious interior make every journey enjoyable.',
        'features': '• 15.6-inch Rotating Screen\n• Panoramic Glass Roof\n• Ventilated Front Seats\n• 12-speaker Sound System\n• Adaptive Cruise Control\n• Lane Keep Assist\n• 360° Camera System\n• 20-inch Alloy Wheels',
        'status': 'available',
        'featured': True
    },
    {
        'name': 'Cannon',
        'brand': 'GWM',
        'model_year': 2024,
        'daily_price': 85.00,
        'weekly_price': 530.00,
        'rent_to_own_price': 38500.00,
        'rent_to_own_term': 60,
        'min_rental_days': 2,
        'total_units': 2,
        'available_units': 2,
        'max_weekly_bookings': 3,
        'fuel_type': 'Diesel',
        'transmission': 'Automatic',
        'seats': 5,
        'luggage_capacity': 6,
        'description': 'The GWM Cannon is a rugged and capable pickup truck, perfect for work or adventure. Combines utility with modern comfort features.',
        'features': '• 9-inch Touchscreen\n• Leather Seats\n• Rear Diff Lock\n• Terrain Response System\n• Trailer Sway Control\n• Hill Descent Control\n• Roof Rails\n• 18-inch Alloy Wheels',
        'status': 'available',
        'featured': False
    },
    {
        'name': 'Shark 6',
        'brand': 'BYD',
        'model_year': 2024,
        'daily_price': 95.00,
        'weekly_price': 590.00,
        'rent_to_own_price': 42500.00,
        'rent_to_own_term': 60,
        'min_rental_days': 2,
        'total_units': 2,
        'available_units': 2,
        'max_weekly_bookings': 3,
        'fuel_type': 'Hybrid',
        'transmission': 'Automatic',
        'seats': 5,
        'luggage_capacity': 5,
        'description': 'The BYD Shark 6 is a powerful hybrid SUV with aggressive styling and advanced technology. Exceptional performance and efficiency.',
        'features': '• 12.8-inch Rotating Screen\n• Premium Sound System\n• Heated & Ventilated Seats\n• Wireless Charging Pad\n• Blind Spot Monitoring\n• Rear Cross Traffic Alert\n• Powered Tailgate\n• 19-inch Alloy Wheels',
        'status': 'available',
        'featured': True
    },
    {
        'name': 'Model Y',
        'brand': 'Tesla',
        'model_year': 2024,
        'daily_price': 120.00,
        'weekly_price': 750.00,
        'rent_to_own_price': 55000.00,
        'rent_to_own_term': 72,
        'min_rental_days': 1,
        'total_units': 2,
        'available_units': 2,
        'max_weekly_bookings': 4,
        'fuel_type': 'Electric',
        'transmission': 'Automatic',
        'seats': 5,
        'luggage_capacity': 5,
        'description': 'The Tesla Model Y is an all-electric SUV with cutting-edge technology, exceptional range, and performance. Experience the future of driving.',
        'features': '• 15-inch Touchscreen\n• Autopilot\n• Glass Roof\n• Heated Seats All Around\n• Premium Audio\n• HEPA Air Filtration\n• Sentry Mode\n• 19-inch Alloy Wheels',
        'status': 'available',
        'featured': True
    }
]

# Correct path to your images
IMAGES_BASE_PATH = '/Users/iam_ankon/Desktop/ride-solutions/backend/media/cars/2026/04/22/'

# Map car names to image filename patterns
CAR_IMAGE_MAPPING = {
    'Chery C5': {
        'brand': 'Chery',
        'name': 'C5',
        'patterns': ['Chery_C5', 'C5']
    },
    'Chery Tiggo 4': {
        'brand': 'Chery',
        'name': 'Tiggo 4',
        'patterns': ['Chery_Tiggo_4', 'Tiggo_4', 'Chery_Tiggo4']
    },
    'BYD Sealion 6': {
        'brand': 'BYD',
        'name': 'Sealion 6',
        'patterns': ['BYD_Sealion_6', 'Sealion_6', 'BYD_Sealion6']
    },
    'GWM Cannon': {
        'brand': 'GWM',
        'name': 'Cannon',
        'patterns': ['GWM_Cannon', 'Cannon']
    },
    'BYD Shark 6': {
        'brand': 'BYD',
        'name': 'Shark 6',
        'patterns': ['BYD_Shark_6', 'Shark_6', 'BYD_Shark6']
    },
    'Tesla Model Y': {
        'brand': 'Tesla',
        'name': 'Model Y',
        'patterns': ['Tesla_Model_Y', 'Model_Y', 'Tesla_ModelY']
    }
}

def get_admin_user():
    """Get or create admin user"""
    try:
        admin = User.objects.get(username='admin')
        print(f"✓ Found admin user: {admin.username}")
        return admin
    except User.DoesNotExist:
        print("Creating admin user...")
        admin = User.objects.create_superuser(
            username='admin',
            email='admin@ridesolutions.com',
            password='ride12345'
        )
        print(f"✓ Created admin user: {admin.username}")
        return admin

def create_cars(admin):
    """Create car records in database with admin as owner"""
    print("=" * 60)
    print("Step 1: Creating Car Records")
    print("=" * 60)
    
    created_cars = []
    
    for car_data in CAR_DATA:
        # Check if car already exists
        car, created = Car.objects.get_or_create(
            name=car_data['name'],
            brand=car_data['brand'],
            defaults=car_data
        )
        
        # Set owner to admin
        if car.owner != admin:
            car.owner = admin
            car.save()
        
        if created:
            print(f"  ✅ CREATED: {car.brand} {car.name}")
            created_cars.append(car)
        else:
            print(f"  🔄 EXISTS: {car.brand} {car.name} (owner set to admin)")
    
    print(f"\n  📊 Total cars in database: {Car.objects.count()}")
    return created_cars

def load_car_images():
    """Load images from local filesystem to car models"""
    print("\n" + "=" * 60)
    print("Step 2: Loading Car Images")
    print("=" * 60)
    print(f"Looking for images in: {IMAGES_BASE_PATH}\n")
    
    # Check if directory exists
    if not os.path.exists(IMAGES_BASE_PATH):
        print(f"  ❌ ERROR: Directory not found!")
        print(f"     Path: {IMAGES_BASE_PATH}")
        return 0
    
    # List all image files
    all_files = os.listdir(IMAGES_BASE_PATH)
    image_files = [f for f in all_files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif'))]
    
    if not image_files:
        print(f"  ⚠️ No image files found in directory!")
        return 0
    
    print(f"  📁 Found {len(image_files)} total image files:")
    for f in sorted(image_files)[:10]:
        print(f"     • {f}")
    if len(image_files) > 10:
        print(f"     ... and {len(image_files) - 10} more")
    
    print("\n" + "-" * 60)
    
    total_loaded = 0
    
    # Process each car
    for car_key, car_info in CAR_IMAGE_MAPPING.items():
        print(f"\n📸 Processing: {car_key}")
        
        # Find the car in database
        try:
            car = Car.objects.get(
                brand=car_info['brand'],
                name=car_info['name']
            )
            print(f"  ✓ Found car: {car.brand} {car.name}")
        except Car.DoesNotExist:
            print(f"  ✗ Car not found: {car_info['brand']} {car_info['name']}")
            continue
        
        # Find matching image files for this car
        matching_images = []
        for filename in image_files:
            for pattern in car_info['patterns']:
                if pattern in filename:
                    # Extract number from filename for sorting
                    import re
                    numbers = re.findall(r'\d+', filename)
                    number = int(numbers[-1]) if numbers else 0
                    matching_images.append((number, filename))
                    break
        
        if not matching_images:
            print(f"  ⚠️ No matching images found")
            print(f"     Looking for patterns: {', '.join(car_info['patterns'])}")
            continue
        
        # Sort by number
        matching_images.sort(key=lambda x: x[0])
        matching_images = [f[1] for f in matching_images]
        
        print(f"  ✓ Found {len(matching_images)} matching images")
        
        # Check if car already has images
        existing_images = CarImage.objects.filter(car=car)
        existing_count = existing_images.count()
        
        if existing_count > 0:
            print(f"  🗑️ Removing {existing_count} existing images")
            existing_images.delete()
        
        # Load each image
        success_count = 0
        for idx, filename in enumerate(matching_images):
            file_path = os.path.join(IMAGES_BASE_PATH, filename)
            
            try:
                with open(file_path, 'rb') as f:
                    is_primary = (idx == 0)
                    car_image = CarImage(car=car, is_primary=is_primary)
                    car_image.image.save(filename, File(f), save=True)
                    
                    print(f"  ✓ Loaded {idx+1}/{len(matching_images)}: {filename} {'⭐ PRIMARY' if is_primary else ''}")
                    success_count += 1
                    total_loaded += 1
                    
            except Exception as e:
                print(f"  ✗ Failed to load {filename}: {str(e)[:100]}")
        
        print(f"  ✅ Successfully loaded {success_count}/{len(matching_images)} images")
    
    return total_loaded

def verify_data():
    """Verify all data was loaded correctly"""
    print("\n" + "=" * 60)
    print("Step 3: Verification Report")
    print("=" * 60)
    
    cars = Car.objects.all()
    
    if not cars:
        print("\n  ❌ No cars found in database!")
        return
    
    print(f"\n  📊 Total Cars: {cars.count()}")
    print("\n  Detailed Report:")
    print("  " + "-" * 50)
    
    for car in cars:
        images = CarImage.objects.filter(car=car)
        primary_image = images.filter(is_primary=True).first()
        owner_name = car.owner.username if car.owner else 'No owner'
        
        status_icon = "✅" if images.count() > 0 else "⚠️"
        print(f"\n  {status_icon} {car.brand} {car.name}")
        print(f"     • Owner: {owner_name}")
        print(f"     • Daily Rate: ${car.daily_price}/day")
        print(f"     • Weekly Rate: ${car.weekly_price}/week")
        print(f"     • Status: {car.status}")
        print(f"     • Available Units: {car.available_units}/{car.total_units}")
        print(f"     • Images: {images.count()}")
        if primary_image:
            print(f"     • Primary Image: Yes")
        if images.count() == 0:
            print(f"     • ⚠️ WARNING: No images loaded!")

def run_full_setup():
    """Run the complete setup process"""
    print("\n" + "🚗" * 30)
    print("COMPLETE CAR DATA SETUP")
    print("🚗" * 30 + "\n")
    
    # Step 0: Get admin user
    admin = get_admin_user()
    
    # Step 1: Create cars with admin as owner
    cars = create_cars(admin)
    
    if not cars:
        print("\n⚠️ No new cars created, but existing cars will be updated with admin owner")
    
    # Step 2: Load images
    total_images = load_car_images()
    
    # Step 3: Verify
    verify_data()
    
    # Final summary
    print("\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)
    print(f"  ✅ Cars in database: {Car.objects.count()}")
    print(f"  ✅ Cars with admin owner: {Car.objects.filter(owner=admin).count()}")
    print(f"  ✅ Images loaded: {total_images}")
    print(f"  📊 Total images in DB: {CarImage.objects.count()}")
    
    # Check for any cars missing images
    cars_without_images = []
    for car in Car.objects.all():
        if CarImage.objects.filter(car=car).count() == 0:
            cars_without_images.append(f"{car.brand} {car.name}")
    
    if cars_without_images:
        print(f"\n  ⚠️ Cars without images: {', '.join(cars_without_images)}")
    else:
        print(f"\n  🎉 All cars have images! Perfect!")
    
    print("\n" + "=" * 60)
    print("SETUP COMPLETE! 🚗")
    print("=" * 60)

if __name__ == "__main__":
    run_full_setup()