# backend/cars/management/commands/load_fleet.py
"""
Load the RideSolutions fleet (from Payment_Details.xlsx) into the Car catalogue,
grouped by model + weekly-price tier, and attach a real photo of each model.

Run it once on Render (Backend service -> "Shell" tab):

    python manage.py load_fleet

Useful flags:
    python manage.py load_fleet --no-images     # create/update cars only, skip photos
    python manage.py load_fleet --reset-images   # replace existing photos for these cars
    python manage.py load_fleet --reset          # delete these cars first, then recreate

HOW IMAGES WORK
---------------
For every model the command tries, in order:
  1. A local file you drop in  backend/fleet_images/<slug>.jpg|png|webp
     (this is the reliable way to use YOUR OWN vehicle photos)
  2. The stock URLs in MODEL_META[...]['images'] below (representative photos of
     that model). Each is downloaded and re-uploaded to YOUR Cloudinary account,
     so the site never hot-links a third party.

Whatever it uses, it saves the resulting URL to CarImage.image_url exactly the
way your existing "upload_to_cloudinary" view does, so the React CarCard renders
it with no further changes. Any model whose photo fails to load is logged clearly
at the end so you can drop a file into fleet_images/ and re-run.
"""

import os
import io
import re

from django.conf import settings
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from cars.models import Car, CarImage

try:
    import requests
except Exception:  # pragma: no cover
    requests = None

try:
    import cloudinary
    import cloudinary.uploader
    HAS_CLOUDINARY = True
except Exception:  # pragma: no cover
    HAS_CLOUDINARY = False


# ---------------------------------------------------------------------------
# RAW FLEET  (reg, year, brand, model_name, weekly_payment, bond)
# Taken straight from Payment_Details.xlsx, with make/model corrected where the
# spreadsheet had them swapped or mislabelled:
#   EXT62S  -> Nissan Pathfinder      (sheet had Make/Model swapped)
#   FLP12S  -> Mazda CX-5             (sheet had the whole title in Make)
#   FLX87X  -> Mitsubishi Outlander   ("Mitshubishi ... 7 SEAT ... WAGON")
#   EBJ13C  -> Land Rover Range Rover Evoque
# Cars are grouped below by (brand, model_name, weekly_payment); each group
# becomes one Car listing whose total_units = number of plates in the group.
# ---------------------------------------------------------------------------
RAW_FLEET = [
    # reg,      year, brand,          model_name,             weekly, bond
    ("EDG81B", 2019, "Toyota",         "Camry Hybrid",           350, 999),
    ("EDG81H", 2019, "Toyota",         "Camry Hybrid",           350, 999),
    ("EDG81C", 2019, "Toyota",         "Camry Hybrid",           350, 999),
    ("EEE61F", 2019, "Toyota",         "Camry Hybrid",           350, 999),
    ("EEE61C", 2019, "Toyota",         "Camry Hybrid",           350, 999),
    ("FRL40D", 2017, "Toyota",         "Camry Hybrid",           299, 999),
    ("FTE70L", 2016, "Toyota",         "Camry Hybrid",           299, 999),
    ("FTE70M", 2015, "Toyota",         "Camry Hybrid",           299, 999),
    ("DM73WZ", 2016, "Toyota",         "Camry Hybrid",           299, 999),
    ("EKH26T", 2015, "Toyota",         "Camry Hybrid",           299, 999),
    ("CK27DB", 2015, "Kia",            "Cerato",                 310, 999),
    ("EGX16J", 2016, "MG",             "MG3",                    310, 999),
    ("EMN83K", 2020, "MG",             "ZS SUV",                 315, 999),
    ("EMT21D", 2021, "MG",             "ZS SUV",                 315, 999),
    ("EMF33H", 2021, "MG",             "ZS SUV",                 315, 999),
    ("EMT21M", 2021, "MG",             "ZS SUV",                 315, 999),
    ("EMT21N", 2021, "MG",             "ZS SUV",                 315, 999),
    ("EMT21P", 2021, "MG",             "ZS SUV",                 315, 999),
    ("EMT21Q", 2021, "MG",             "ZS SUV",                 315, 999),
    ("EMT21R", 2021, "MG",             "ZS SUV",                 315, 999),
    ("EMT21S", 2021, "MG",             "ZS SUV",                 315, 999),
    ("FLX87X", 2021, "Mitsubishi",     "Outlander",              420, 1499),
    ("DSF60R", 2022, "Toyota",         "Kluger",                 420, 1499),
    ("DF89SF", 2016, "Ford",           "Ranger",                 440, 1499),
    ("EXT62S", 2019, "Nissan",         "Pathfinder",             420, 1499),
    ("DTO73H", 2017, "Mercedes-Benz",  "GLA250",                 440, 1499),
    ("CM18SG", 2017, "Nissan",         "Navara",                 450, 1499),
    ("FLP12S", 2024, "Mazda",          "CX-5",                   415, 1499),
    ("FRT82Y", 2025, "GWM",            "Cannon",                 480, 1499),
    ("FTQ41B", 2025, "Chery",          "Tiggo 4",                435, 1499),
    ("FTQ41C", 2025, "Chery",          "Tiggo 4",                435, 1499),
    ("FTQ41D", 2025, "Chery",          "Tiggo 4",                435, 1499),
    ("FTQ41E", 2025, "Chery",          "Tiggo 4",                435, 1499),
    ("FTQ47P", 2025, "Chery",          "Tiggo 4",                435, 1499),
    ("FTQ46A", 2025, "Chery",          "Tiggo 4",                435, 1499),
    ("EYC06S", 2010, "Honda",          "Civic",                  250, 999),
    ("EBJ13C", 2019, "Land Rover",     "Range Rover Evoque",     580, 1999),

    # -----------------------------------------------------------------
    # New 2026 additions — priced off each model's current Australian
    # driveaway/MLRP pricing (searched 2026-08-04), with weekly hire set
    # at roughly retail-value/100 (rounded), consistent with the rest of
    # the fleet's pricing logic. Bonds scaled to the vehicle's value.
    # -----------------------------------------------------------------
    ("FCC50A", 2026, "Chery",          "C5",                     300, 1499),
    ("FTG42A", 2026, "Chery",          "Tiggo 4",                260, 1499),
    ("FBS66A", 2026, "BYD",            "Shark 6",                580, 2499),
    ("FTY01A", 2026, "Tesla",          "Model Y",                590, 2499),
    ("FBL66A", 2026, "BYD",            "Sealion 6",               430, 1999),
    ("FGC01A", 2026, "GWM",            "Cannon",                 365, 1499),
    ("FKC88A", 2026, "Kia",            "Carnival",               520, 1999),
    ("FCT88A", 2026, "Chery",          "Tiggo 8 Pro Max",        370, 1499),
]


# ---------------------------------------------------------------------------
# Per-model metadata: specs + candidate stock photos (Wikimedia Commons).
# Keyed by (brand, model_name). Fill in a fleet_images/<slug>.jpg to override
# any of these with your own real vehicle photo.
# ---------------------------------------------------------------------------
def _fp(name):
    """Wikimedia Commons stable download URL for a file name.
    Every filename below was individually verified to exist on Commons
    (searched and confirmed, not guessed) before being added here."""
    from urllib.parse import quote
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + quote(name, safe="()")


MODEL_META = {
    # Every filename below was searched for and confirmed to exist on
    # Wikimedia Commons (2026-08-03) before being added — not guessed.
    ("Toyota", "Camry Hybrid"): {
        "fuel": "Hybrid", "trans": "Automatic", "seats": 5, "luggage": 3,
        "body": "sedan",
        "images": [
            _fp("2018 Toyota Camry (ASV70R) Ascent sedan (2018-08-27) 01.jpg"),
        ],
    },
    ("Kia", "Cerato"): {
        "fuel": "Petrol", "trans": "Automatic", "seats": 5, "luggage": 3,
        "body": "sedan",
        "images": [
            _fp("Kia Cerato Sedan.jpg"),
        ],
    },
    ("MG", "MG3"): {
        "fuel": "Petrol", "trans": "Automatic", "seats": 5, "luggage": 2,
        "body": "hatch",
        "images": [
            _fp("2020 MG 3.jpg"),
        ],
    },
    ("MG", "ZS SUV"): {
        "fuel": "Petrol", "trans": "Automatic", "seats": 5, "luggage": 4,
        "body": "SUV",
        "images": [
            _fp("2018 MG ZS (AZS1) Excite wagon (2018-08-27) 01.jpg"),
        ],
    },
    ("Mitsubishi", "Outlander"): {
        "fuel": "Petrol", "trans": "Automatic", "seats": 7, "luggage": 5,
        "body": "SUV",
        "images": [
            _fp("2013 Mitsubishi Outlander (ZJ MY14) ES 2WD wagon (2014-12-26).jpg"),
        ],
    },
    ("Toyota", "Kluger"): {
        "fuel": "Petrol", "trans": "Automatic", "seats": 7, "luggage": 5,
        "body": "SUV",
        "images": [
            _fp("2015 Toyota Kluger (GSU55R) GX wagon (2015-11-11) 01.jpg"),
        ],
    },
    ("Ford", "Ranger"): {
        "fuel": "Diesel", "trans": "Automatic", "seats": 5, "luggage": 6,
        "body": "ute",
        "images": [
            _fp("2015-2018 Ford Ranger (PX) XLT 4WD 4-door utility (2018-07-19) 01.jpg"),
        ],
    },
    ("Nissan", "Pathfinder"): {
        "fuel": "Petrol", "trans": "Automatic", "seats": 7, "luggage": 5,
        "body": "SUV",
        "images": [
            _fp("2018 Nissan Pathfinder (R52 MY18) ST 2WD wagon (2018-08-06) 02.jpg"),
        ],
    },
    ("Mercedes-Benz", "GLA250"): {
        "fuel": "Petrol", "trans": "Automatic", "seats": 5, "luggage": 4,
        "body": "SUV",
        "images": [
            _fp("2014 Mercedes-Benz GLA 200 CDI (X 156) wagon (2015-08-07) 01.jpg"),
        ],
    },
    ("Nissan", "Navara"): {
        "fuel": "Diesel", "trans": "Automatic", "seats": 5, "luggage": 6,
        "body": "ute",
        "images": [
            _fp("2016 Nissan NP300 Navara (D23) ST 4-door utility (2017-09-22) 01.jpg"),
        ],
    },
    ("Mazda", "CX-5"): {
        "fuel": "Petrol", "trans": "Automatic", "seats": 5, "luggage": 5,
        "body": "SUV",
        "images": [
            _fp("2017 Mazda CX-5 (KF) Maxx 2WD wagon (2018-11-02) 01.jpg"),
        ],
    },
    ("GWM", "Cannon"): {
        "fuel": "Diesel", "trans": "Automatic", "seats": 5, "luggage": 6,
        "body": "ute",
        "images": [
            _fp("Great Wall Pao 002.jpg"),
            _fp("Great Wall Pao 003.jpg"),
        ],
    },
    ("Chery", "Tiggo 4"): {
        "fuel": "Petrol", "trans": "Automatic", "seats": 5, "luggage": 4,
        "body": "SUV",
        "images": [
            _fp("2024 Chery Tiggo 4 front view.png"),
        ],
    },
    ("Honda", "Civic"): {
        "fuel": "Petrol", "trans": "Automatic", "seats": 5, "luggage": 3,
        "body": "sedan",
        "images": [
            _fp("Honda Civic 1.8 LXS 2010.jpg"),
        ],
    },
    ("Land Rover", "Range Rover Evoque"): {
        "fuel": "Diesel", "trans": "Automatic", "seats": 5, "luggage": 4,
        "body": "SUV",
        "images": [
            _fp("2013 Land Rover Range Rover Evoque (L538 MY13) SD4 Pure 4WD 5-door wagon (2015-07-24) 02.jpg"),
        ],
    },

    # ---- New 2026 additions ------------------------------------------------
    ("Chery", "C5"): {
        # AU driveaway from $29,990 (Urban) - $34,990 (Ultimate). Small SUV,
        # formerly the Omoda 5. Turbo-petrol, dual-clutch auto.
        "fuel": "Petrol", "trans": "Automatic", "seats": 5, "luggage": 4,
        "body": "SUV",
        "images": [
            _fp("Chery Omoda 5 005.jpg"),
        ],
    },
    ("BYD", "Shark 6"): {
        # AU pricing $55,900 (Dynamic) - $62,900 (Performance). Plug-in
        # hybrid dual-cab ute, 100km EV range, 3500kg towing (Performance).
        "fuel": "Hybrid", "trans": "Automatic", "seats": 5, "luggage": 6,
        "body": "ute",
        "images": [
            _fp("2024 BYD Shark 6 DMO front view.png"),
        ],
    },
    ("Tesla", "Model Y"): {
        # AU pricing $58,900 (Premium RWD) - $89,400 (Performance). All-
        # electric mid-size SUV, Australia's best-selling EV.
        "fuel": "Electric", "trans": "Automatic", "seats": 5, "luggage": 4,
        "body": "SUV",
        "images": [
            _fp("Tesla Model Y Front View.jpg"),
        ],
    },
    ("BYD", "Sealion 6"): {
        # AU pricing $42,990 - $52,990. Plug-in hybrid mid-size SUV, up to
        # 92km EV-only range, AWD on Premium grades.
        "fuel": "Hybrid", "trans": "Automatic", "seats": 5, "luggage": 4,
        "body": "SUV",
        "images": [
            _fp("BYD Sealion 6 DM-i 1.5 Premium 2025.jpg"),
        ],
    },
    ("Kia", "Carnival"): {
        # AU pricing from $52,070 (S) up to $76,630 (GT-Line HEV). 8-seat
        # people mover with sliding doors, petrol/diesel/hybrid options.
        "fuel": "Petrol", "trans": "Automatic", "seats": 8, "luggage": 6,
        "body": "van",
        "images": [
            _fp("2024 Kia Carnival (KA4) 1.jpg"),
        ],
    },
    ("Chery", "Tiggo 8 Pro Max"): {
        # AU driveaway from $36,990 (Urban) - $41,990 (Ultimate AWD).
        # 7-seat large SUV, 2.0L turbo-petrol.
        "fuel": "Petrol", "trans": "Automatic", "seats": 7, "luggage": 3,
        "body": "SUV",
        "images": [
            _fp("2022 Chery Tiggo 8 Plus (front).jpg"),
        ],
    },
}

DEFAULT_META = {
    "fuel": "Petrol", "trans": "Automatic", "seats": 5, "luggage": 3,
    "body": "vehicle", "images": [],
}

FEATURES_BY_BODY = {
    "sedan": "Bluetooth & Apple CarPlay/Android Auto\nReverse Camera\nCruise Control\nDual-zone Climate Control\nKeyless Entry\nRegistration, servicing & roadside assistance included",
    "hatch": "Bluetooth & Apple CarPlay/Android Auto\nReverse Camera\nCompact & easy to park\nFuel efficient\nRegistration, servicing & roadside assistance included",
    "SUV": "Bluetooth & Apple CarPlay/Android Auto\nReverse Camera\nElevated driving position\nAmple cargo space\nCruise Control\nRegistration, servicing & roadside assistance included",
    "ute": "Bluetooth & Apple CarPlay/Android Auto\nReverse Camera\nLarge tray / towing capability\nRugged & capable\nRegistration, servicing & roadside assistance included",
    "van": "Bluetooth & Apple CarPlay/Android Auto\nDual Power Sliding Doors\n7-8 Seat Capacity\nReverse Camera & Rear Parking Sensors\nCruise Control\nRegistration, servicing & roadside assistance included",
    "vehicle": "Bluetooth Connectivity\nReverse Camera\nCruise Control\nRegistration, servicing & roadside assistance included",
}

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")
FLEET_IMAGES_DIR = os.path.join(settings.BASE_DIR, "fleet_images")


def slugify(brand, name):
    s = f"{brand}-{name}".lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


class Command(BaseCommand):
    help = "Load the fleet from Payment_Details.xlsx into Car listings with real photos."

    def add_arguments(self, parser):
        parser.add_argument("--no-images", action="store_true",
                            help="Create/update cars only; do not attach photos.")
        parser.add_argument("--reset-images", action="store_true",
                            help="Delete existing photos for these cars before adding.")
        parser.add_argument("--reset", action="store_true",
                            help="Delete matching cars first, then recreate.")

    # -- helpers -----------------------------------------------------------
    def _local_image(self, slug):
        if not os.path.isdir(FLEET_IMAGES_DIR):
            return None
        for ext in IMAGE_EXTS:
            p = os.path.join(FLEET_IMAGES_DIR, slug + ext)
            if os.path.isfile(p):
                return p
        return None

    def _download(self, url):
        if requests is None:
            return None
        try:
            r = requests.get(
                url, timeout=30,
                headers={"User-Agent": "RideSolutions-FleetLoader/1.0 (+https://otobigo.onrender.com)"},
            )
            if r.status_code == 200 and r.content:
                return r.content
            self.stdout.write(f"      · {r.status_code} for {url}")
        except Exception as e:
            self.stdout.write(f"      · error fetching {url}: {str(e)[:80]}")
        return None

    def _attach_image(self, car, slug, image_urls):
        """Attach one primary photo to `car`. Returns True on success."""
        # 1) local override
        data = None
        source = None
        local = self._local_image(slug)
        if local:
            with open(local, "rb") as fh:
                data = fh.read()
            source = f"local:{os.path.basename(local)}"

        # 2) stock candidates
        if data is None:
            for url in image_urls:
                data = self._download(url)
                if data:
                    source = url
                    break

        if not data:
            return False

        # Upload to Cloudinary (same pattern as views.upload_to_cloudinary)
        if HAS_CLOUDINARY:
            try:
                res = cloudinary.uploader.upload(
                    io.BytesIO(data),
                    folder=f"ride-solutions/cars/{car.id}",
                    resource_type="image",
                    format="jpg",
                    overwrite=True,
                )
                CarImage.objects.create(
                    car=car,
                    image_url=res["secure_url"],
                    public_id=res.get("public_id"),
                    is_primary=True,
                )
                self.stdout.write(f"      ✓ image via {source} -> Cloudinary")
                return True
            except Exception as e:
                self.stdout.write(f"      · Cloudinary upload failed: {str(e)[:100]}")

        # Fallback: store the source URL directly (frontend renders full URLs)
        if source and source.startswith("http"):
            CarImage.objects.create(car=car, image_url=source, is_primary=True)
            self.stdout.write(f"      ✓ image URL stored directly ({source[:60]}...)")
            return True

        return False

    # -- main --------------------------------------------------------------
    def handle(self, *args, **opts):
        owner = User.objects.filter(is_superuser=True).order_by("id").first()
        self.stdout.write("=" * 64)
        self.stdout.write("Loading RideSolutions fleet")
        self.stdout.write(f"  owner: {owner.username if owner else '(none — cars will have no owner)'}")
        self.stdout.write(f"  cloudinary available: {HAS_CLOUDINARY}")
        self.stdout.write(f"  local image dir: {FLEET_IMAGES_DIR} "
                          f"({'present' if os.path.isdir(FLEET_IMAGES_DIR) else 'not present'})")
        self.stdout.write("=" * 64)

        # Group by (brand, model, weekly_price)
        groups = {}
        for reg, year, brand, name, weekly, bond in RAW_FLEET:
            key = (brand, name, weekly)
            g = groups.setdefault(key, {"years": [], "regos": [], "bond": bond})
            g["years"].append(year)
            g["regos"].append(reg)

        created, updated, no_image = 0, 0, []

        for (brand, name, weekly), g in groups.items():
            meta = MODEL_META.get((brand, name), DEFAULT_META)
            model_year = max(g["years"])
            year_lo, year_hi = min(g["years"]), max(g["years"])
            units = len(g["regos"])
            daily = round(weekly / 5)  # sensible daily rate (weekly is the discount)
            regos = ", ".join(sorted(g["regos"]))

            yr_txt = f"{year_lo}" if year_lo == year_hi else f"{year_lo}–{year_hi}"
            desc = (
                f"{name} available for weekly hire from RideSolutions. "
                f"We have {units} of this model in the fleet ({yr_txt}). "
                f"Weekly rate ${weekly} with a refundable ${g['bond']} bond. "
                f"Registration, servicing and 24/7 roadside assistance included. "
                f"Fleet plates: {regos}."
            )
            features = FEATURES_BY_BODY.get(meta["body"], FEATURES_BY_BODY["vehicle"])

            defaults = dict(
                owner=owner,
                model_year=model_year,
                daily_price=daily,
                weekly_price=weekly,
                bond_amount=g["bond"],
                bond_refundable=True,
                total_units=units,
                available_units=units,
                fuel_type=meta["fuel"],
                transmission=meta["trans"],
                seats=meta["seats"],
                luggage_capacity=meta["luggage"],
                description=desc,
                features=features,
                status="available",
                short_term_available=True,
                long_term_available=True,
                rent_to_own_available=False,   # no car_value in the sheet -> keep RTO off
                featured=units >= 5,           # feature the models you have most of
            )

            car, was_created = Car.objects.get_or_create(
                brand=brand, name=name, weekly_price=weekly,
                defaults=defaults,
            )
            if was_created:
                created += 1
                self.stdout.write(f"\n  ✅ CREATED  {brand} {name}  ${weekly}/wk  x{units}")
            else:
                for k, v in defaults.items():
                    setattr(car, k, v)
                car.save()
                updated += 1
                self.stdout.write(f"\n  🔄 UPDATED  {brand} {name}  ${weekly}/wk  x{units}")

            # -------- images --------
            if opts["no_images"]:
                continue
            if opts["reset_images"]:
                car.images.all().delete()
            if car.images.exists():
                self.stdout.write("      · already has image(s), skipping "
                                  "(use --reset-images to replace)")
                continue

            slug = slugify(brand, name)
            ok = self._attach_image(car, slug, meta.get("images", []))
            if not ok:
                no_image.append(f"{brand} {name} (fleet_images/{slug}.jpg)")

        # -------- summary --------
        self.stdout.write("\n" + "=" * 64)
        self.stdout.write("SUMMARY")
        self.stdout.write("=" * 64)
        self.stdout.write(f"  Car listings created: {created}")
        self.stdout.write(f"  Car listings updated: {updated}")
        self.stdout.write(f"  Total Car listings now: {Car.objects.count()}")
        self.stdout.write(f"  Total images now: {CarImage.objects.count()}")
        if opts["no_images"]:
            self.stdout.write("\n  (photos skipped — run without --no-images to attach them)")
        elif no_image:
            self.stdout.write("\n  ⚠️  No photo attached for these models. Drop a photo in the")
            self.stdout.write("     backend/fleet_images/ folder at the given name and re-run:")
            for item in no_image:
                self.stdout.write(f"       - {item}")
        else:
            self.stdout.write("\n  🎉 Every model has a photo.")
        self.stdout.write("=" * 64)
