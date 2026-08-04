# Fleet import — add all cars from Payment_Details.xlsx (with real photos)

A new management command, `cars/management/commands/load_fleet.py`, turns your
37 fleet vehicles into **16 car listings** (one per model + price tier, with
`total_units` = how many of that model you own) and attaches a real photo of
each model.

## What it does
- Groups the spreadsheet by model + weekly price. Duplicate plates of the same
  model become one listing with a unit count (e.g. MG ZS SUV ×9, Chery Tiggo 4 ×6).
- Maps `Payment` → `weekly_price`, `Bond` → `bond_amount`, `Year` → `model_year`.
  Daily price is derived as `weekly / 5`.
- Corrects the mislabelled rows from the sheet (EXT62S = Nissan Pathfinder,
  FLP12S = Mazda CX-5, FLX87X = Mitsubishi Outlander, EBJ13C = Range Rover Evoque).
- Lists every registration plate in each listing's description.
- Downloads a representative photo of each model and re-uploads it to **your**
  Cloudinary account (identical to your admin "upload to cloudinary" flow), then
  saves the URL to `CarImage.image_url` so the React `CarCard` renders it as-is.
- Is **idempotent**: re-running updates the same 16 listings instead of duplicating.

## Deploy & run (Render)
1. Commit the new files and push (Render auto-deploys the backend):
   - `backend/cars/management/commands/load_fleet.py`
   - `backend/fleet_images/` (folder for your own photos — optional)
2. In the Render dashboard open the **backend service → "Shell"** tab and run:
   ```
   python manage.py load_fleet
   ```
3. Reload the site — the cars appear on the Cars page with photos.

No new dependencies: `requests`, `cloudinary`, `openpyxl` are already in
requirements.txt.

## Flags
```
python manage.py load_fleet                # create/update + attach photos
python manage.py load_fleet --no-images    # cars only, no photos
python manage.py load_fleet --reset-images # replace existing photos
python manage.py load_fleet --reset        # delete these listings, then recreate
```

## Using your OWN car photos
The auto-sourced stock photos are best-effort. For any model, drop a real photo
into `backend/fleet_images/` (see that folder's README for exact file names) and
run `python manage.py load_fleet --reset-images`. A local file always wins, and
the command prints which models still need a photo.

## Notes / assumptions
- Two "Toyota Camry Hybrid" listings are created because the sheet prices them
  differently ($350/wk for the 2019s, $299/wk for the 2015–2017s).
- Rent-to-own is left **off** (the sheet has no car value). To enable it for a
  model, set that Car's `car_value` in the admin and tick `rent_to_own_available`.
- Listing owner is set to your existing superuser (or left blank if none exists);
  the command never creates credentials.
