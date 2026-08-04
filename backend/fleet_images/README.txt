DROP YOUR OWN VEHICLE PHOTOS HERE (optional)
============================================
To use a real photo of one of YOUR cars instead of the auto-sourced stock
photo, put an image in this folder named after the model, then re-run:

    python manage.py load_fleet --reset-images

File names (any of .jpg .jpeg .png .webp):
    toyota-camry-hybrid.jpg          (covers both Camry price tiers)
    kia-cerato.jpg
    mg-mg3.jpg
    mg-zs-suv.jpg
    mitsubishi-outlander.jpg
    toyota-kluger.jpg
    ford-ranger.jpg
    nissan-pathfinder.jpg
    mercedes-benz-gla250.jpg
    nissan-navara.jpg
    mazda-cx-5.jpg
    gwm-cannon.jpg
    chery-tiggo-4.jpg
    honda-civic.jpg
    land-rover-range-rover-evoque.jpg

A local file here always wins over the stock URL. The photo is uploaded to your
own Cloudinary account (same as admin uploads), so it is served from your CDN.
