# backend/cars/management/commands/import_all_data.py
from datetime import datetime, date
from django.core.management.base import BaseCommand
from cars.models import Vehicle, Driver, Insurance, GPSDevice, ServiceRecord, TollOffence, InstallStatus, Claim


class Command(BaseCommand):
    help = 'Import all data from embedded data'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('Starting complete data import...')
        self.stdout.write('=' * 60)

        self.import_vehicles()
        self.import_drivers()
        self.import_insurance()
        self.import_gps_devices()
        self.import_service_records()  # This version uses ONLY existing fields
        self.import_offences()
        self.import_install_status()
        self.import_claims()
        
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('Data import completed!')
        self.stdout.write('=' * 60)

    def get_or_create_vehicle(self, plate):
        if not plate:
            return None
        plate = plate.strip().upper()
        if '/' in plate:
            plate = plate.split('/')[0]
        vehicle, created = Vehicle.objects.get_or_create(
            plate_number=plate,
            defaults={'status': 'active'}
        )
        return vehicle

    def import_vehicles(self):
        self.stdout.write('\n📦 Importing vehicles...')
        
        vehicles_data = [
            ("EMT21Q", "MG", "ZS SUV", "white", "2026-03-17"),
            ("FTE70L", "Toyota", "Camry", "silver", "2026-06-30"),
            ("CK27DB", "Kia", "Cerato", "white", "2026-06-30"),
            ("CG38AY", "Toyota", "Camry", "white", "2026-06-30"),
            ("FTE70M", "Toyota", "Camry", "light blue", "2026-06-30"),
            ("EGX16J", "MG", "MG3", "silver", "2026-07-20"),
            ("FRT82Y", "LDV", "Cannon", "silver", "2026-08-27"),
            ("CF16JX", "Toyota", "Camry", "light blue", "2026-09-15"),
            ("CM18SG", "Nissan", "Navara", "silver", "2026-10-02"),
            ("EEE61C", "Toyota", "Camry", "premium silver", "2026-10-24"),
            ("EKH26T", "Toyota", "Camry", "pearl silver", "2026-10-27"),
            ("EEE61F", "Toyota", "Camry", "eclipse black", "2026-10-30"),
            ("EDG81B", "Toyota", "Camry", "frosted white", "2026-11-07"),
            ("FLP12S", "Mazda", "CX-5", "red", "2026-11-07"),
            ("EDG81C", "Toyota", "Camry", "premium silver", "2026-11-07"),
            ("EDG81H", "Toyota", "Camry", "glacier white", "2026-11-12"),
            ("FTQ41B", "Chery", "Tiggo 4", "red", "2026-11-28"),
            ("FTQ41C", "Chery", "Tiggo 4", "red", "2026-11-28"),
            ("FTQ41D", "Chery", "Tiggo 4", "red", "2026-11-28"),
            ("FTQ41E", "Chery", "Tiggo 4", "red", "2026-11-28"),
            ("FTQ47P", "Chery", "Tiggo 4", "red", "2026-12-16"),
            ("FTQ46A", "Chery", "C5", "red", "2026-12-18"),
            ("EBJ13C", "Land Rover", "Evoque", "white", "2026-03-28"),
            ("DTO73H", "Mercedes-Benz", "GLA250", "silver", "2027-01-24"),
            ("EXT62S", "Nissan", "Pathfinder", "white", "2027-01-29"),
            ("EMN83K", "MG", "ZS SUV", "black", "2027-02-23"),
            ("DF89SF", "Ford", "Ranger", "white", "2027-03-01"),
            ("EMT21D", "MG", "ZS SUV", "white", "2027-03-11"),
            ("EMF33H", "MG", "ZS SUV", "white", "2027-03-11"),
            ("EMT21M", "MG", "ZS SUV", "white", "2027-03-17"),
            ("EMT21N", "MG", "ZS SUV", "white", "2027-03-17"),
            ("EMT21S", "MG", "ZS SUV", "white", "2027-03-17"),
            ("EMT21P", "MG", "ZS SUV", "white", "2027-03-17"),
            ("EMT21R", "MG", "ZS SUV", "white", "2027-03-17"),
            ("FLX87X", "Mitsubishi", "Outlander", "white", "2027-04-10"),
            ("DSF60R", "Toyota", "Kluger", "silver", "2027-04-30"),
        ]
        
        created = 0
        for plate, make, model, colour, expiry in vehicles_data:
            vehicle, created_flag = Vehicle.objects.update_or_create(
                plate_number=plate,
                defaults={
                    'manufacturer': make,
                    'model': model,
                    'colour': colour,
                    'registration_expiry': datetime.strptime(expiry, '%Y-%m-%d').date(),
                    'status': 'active'
                }
            )
            if created_flag:
                created += 1
        
        self.stdout.write(f'  ✅ Vehicles: {created} created, total: {Vehicle.objects.count()}')

    def import_drivers(self):
        self.stdout.write('\n👤 Importing drivers...')
        
        drivers_data = [
            ("EDG81H", "Peter Mutahi Ndun'gu", "2025-12-24", None, True, "25159195", "1997-09-28", "492905865", "petermutahin97@gmail.com"),
            ("EMT21M", "Angeli Dee LIM", "2025-11-04", None, True, "20505840", "1967-07-20", "410889008", "dee_angeli@yahoo.com"),
            ("EMT21S", "Paulo Tau", "2025-10-09", None, True, "15880086", "1976-08-24", "493687157", "taupaulo36@gmail.com"),
            ("DSF60R", "Siosifa Ipa Niuafu", "2022-08-21", None, True, "22280207", "1990-09-10", "410818382", "fakahaofia@gmail.com"),
            ("DTO73H", "Ratu Jona Yabayaba BAVADRA", "2023-12-14", None, True, "15356823", "1981-02-21", "435774713", "onedrop118@gmail.com"),
            ("CM18SG", "Ratu Jona Yabayaba BAVADRA", "2024-06-02", None, True, "15356823", "1981-02-21", "435774713", "onedrop118@gmail.com"),
            ("FLX87X", "Emosi Taginadikalu TIKOIBARAVI", "2024-10-25", None, True, "22724691", "1973-06-23", "0414781435", "amosemosi@gmail.com"),
            ("FRT82Y", "Temo Junior", "2025-09-08", None, True, "23758498", "1990-08-15", "0452045647", "Tjtemo64@gmail.com"),
            ("FTQ41B", "Edward Chan Sau", "2025-12-01", None, True, "21452738", "1981-01-26", "450835771", "Edzaylah@hotmail.com"),
            ("FTQ41C", "Kuranui Natini", "2025-11-30", None, True, "", "1963-02-03", "449100263", "kuranatini@gmail.com"),
            ("FTQ41D", "Etuate PALE", "2025-11-30", None, True, "21573529", "1994-03-30", "413194467", "tonganedz@gmail.com"),
            ("FTQ47P", "Lusiana Lesuma", "2025-12-23", None, True, "22256944", "2000-05-02", "0431266134", "lusianaclesuma29@gmail.com"),
            ("FTQ46A", "Rt Viliame Sauleirogo Nawaqaliva", "2025-12-21", None, True, "25066521", "1991-04-28", "406306419", "nawaqaliva.viliame@yahoo.com"),
            ("EEE61C", "Warren falconer", "2025-07-11", None, True, "13849439", "1984-10-26", "481719549", "Warrenf1984@outlook.com"),
            ("CK27DB", "Malcolm John MARTIN", "2026-01-07", None, True, "4294SC", "1954-09-28", "435819546", "mjays2011@hotmail.com"),
            ("EMN83K", "Palolo Brown", "2026-02-27", None, True, "11854942", "1976-10-15", "410354344", "brownpalolo@gmail.com"),
            ("EMT21D", "Lusi Lamositele", "2026-01-07", None, True, "12219465", "1967-09-22", "0404029566", "Massywill99@gmail.com"),
            ("EMF33H", "Teresa Togagae Faanu", "2025-12-17", None, True, "23884886", "2002-09-23", "410068488", "faanu2309@gmail.com"),
            ("EMT21P", "David Robert Ripley", "2023-04-06", None, True, "24722730", "1983-02-03", "478942909", "Dripz213@hotmail.com"),
            ("EMT21Q", "Maxine Billie Tavai", "2021-06-14", None, True, "12586571", "1979-12-27", "424503891", "maxinebt579@outlook.com"),
            ("EXT62S", "Temo Junior", "2023-11-16", None, True, "23758498", "1990-08-15", "0452045647", "Tjtemo64@gmail.com"),
            ("DF89SF", "Anetone Polamalu", "2025-11-29", None, True, "23089678", "1998-07-07", "421658196", "Anetonepolamalu1@gmail.com"),
            ("CG38AY", "Glynnis Sinaki", "2025-10-13", None, True, "16108304", "1992-07-22", "412010783", "glynnisinaki@gmail.com"),
            ("FTE70M", "Karl Pahulu", "2026-02-19", None, True, "21270247", "1997-07-10", "492242819", "karlpahulu123@outlook.com"),
            ("FTE70L", "Harpreet singh", "2026-01-23", None, True, "24839651", "1985-02-05", "416344297", "Hsl85_2004@yahoo.com"),
            ("EKH26T", "Mitieli Seru Vulaono", "2026-04-10", None, True, "23324063", "1962-09-22", "413798880", "mitchseru@gmail.com"),
        ]
        
        created = 0
        for plate, name, start, end, is_current, licence, dob, phone, email in drivers_data:
            vehicle = self.get_or_create_vehicle(plate)
            if not vehicle:
                continue
                
            driver, created_flag = Driver.objects.update_or_create(
                plate_number=vehicle,
                name=name,
                defaults={
                    'start_date': datetime.strptime(start, '%Y-%m-%d').date() if start else None,
                    'end_date': datetime.strptime(end, '%Y-%m-%d').date() if end else None,
                    'is_current': is_current,
                    'driver_licence_no': licence,
                    'date_of_birth': datetime.strptime(dob, '%Y-%m-%d').date() if dob else None,
                    'phone_number': phone,
                    'email_address': email,
                }
            )
            if created_flag:
                created += 1
        
        self.stdout.write(f'  ✅ Drivers: {created} created, total: {Driver.objects.count()}')

    def import_insurance(self):
        self.stdout.write('\n📋 Importing insurance policies...')
        
        insurance_data = [
            ("EDG81B", "CAR018439804", "Bingle", "Asraful Hasan", "2025-07-09", "2026-07-09", 117.23, 895),
            ("EDG81C", "CAR014231494", "Bingle", "Sadia Kamal Evana", "2025-01-19", "2026-01-19", 86.03, 895),
            ("EEE61C", "CAR014231530", "Bingle", "Sadia Kamal Evana", "2025-01-19", "2026-01-19", 82.92, 895),
            ("EMT21Q", "CAR012163135", "Bingle", "Sadia Kamal Evana", "2025-03-19", "2026-03-19", 54.05, 995),
            ("EMT21M", "CAR012163013", "Bingle", "Sadia Kamal Evana", "2025-03-19", "2026-03-19", 77.57, 995),
            ("EMT21N", "CAR012163064", "Bingle", "Sadia Kamal Evana", "2025-03-19", "2026-03-19", 78.35, 995),
            ("EMT21P", "CAR012163080", "Bingle", "Sadia Kamal Evana", "2025-03-19", "2026-03-19", 73.97, 995),
            ("EMT21S", "CAR012163206", "Bingle", "Sadia Kamal Evana", "2025-03-19", "2026-03-19", 155.67, 995),
            ("DSF60R", "CAR015294244", "Bingle", "Sadia Kamal Evana", "2024-10-23", "2025-10-23", 167.10, 995),
            ("DF89SF", "CAR015824772", "Bingle", "Sadia Kamal Evana", "2025-03-09", "2026-03-09", 72.42, 1800),
            ("EXT62S", "CAR017024028", "Bingle", "Sadia Kamal Evana", "2024-11-13", "2025-11-13", 62.89, 995),
            ("DTO73H", "CAR015481713", "Bingle", "Sadia Kamal Evana", "2024-12-14", "2025-12-14", 119.96, 895),
            ("CM18SG", "CAR016237024", "Bingle", "Sadia Kamal Evana", "2024-06-02", "2025-06-02", 120.15, 995),
            ("FLX87X", "CAR016923790", "Bingle", "Sadia Kamal Evana", "2024-10-21", "2025-10-21", 59.10, 995),
            ("FLP12S", "CAR017029907", "Bingle", "Sadia Kamal Evana", "2024-11-14", "2025-11-14", 75.63, 995),
        ]
        
        created = 0
        for plate, policy, provider, holder, start, end, amount, excess in insurance_data:
            vehicle = self.get_or_create_vehicle(plate)
            if not vehicle:
                continue
                
            insurance, created_flag = Insurance.objects.update_or_create(
                plate_number=vehicle,
                policy_number=policy,
                defaults={
                    'provider': provider,
                    'policy_holder': holder,
                    'start_date': datetime.strptime(start, '%Y-%m-%d').date(),
                    'end_date': datetime.strptime(end, '%Y-%m-%d').date(),
                    'monthly_amount': amount,
                    'excess_fee': excess,
                    'status': 'active'
                }
            )
            if created_flag:
                created += 1
        
        self.stdout.write(f'  ✅ Insurance: {created} created, total: {Insurance.objects.count()}')

    def import_gps_devices(self):
        self.stdout.write('\n📍 Importing GPS devices...')
        
        gps_data = [
            ("EMT21Q", "Sadia Kamal Evana", "2021-03-22", "9172223603", None, None, "0423 973 437", "RideSolutions2021@gmail.com"),
            ("EDG81B", "Md Iftekhar Ul Alam", "2021-03-22", "9172223582", None, None, "0403 875 493", "Ridesolutionss@gmail.com"),
            ("EDG81H", "Md Iftekhar Ul Alam", "2021-03-22", "9172223572", None, "468359578", "0481 304 154", "Ridesolutionss@gmail.com"),
            ("EMT21D", "Shahidul Hasan", "2021-03-22", "9172223557", None, "468878332", "0432 861 169", "Otobigo247@gmail.com"),
            ("EMT21S", "Sadia Kamal Evana", "2021-03-22", "9171859410", None, "468491536", "0412 649 241", "RideSolutions2021@gmail.com"),
            ("CK27DB", "Asraful Hasan", "2021-03-22", "9172223590", None, "432196423", "0403 796 615", "ingeniousbook@gmail.com"),
            ("DF89SF", "Asraful Hasan", "2022-10-24", "19171859386", None, "421996138", None, "ingeniousbook@gmail.com"),
            ("EXT62S", "Asraful Hasan", "2023-11-16", "9172223586", None, "403981997", None, "Otobigo247@gmail.com"),
            ("EMT21P", "Shahidul Hasan", "2021-03-22", "9172223589", None, "468426763", "0481 342 530", "Otobigo247@gmail.com"),
            ("EMN83K", "Intisar Reza Abir", "2021-03-22", "19171859437", None, "468412601", "0468 394 491", "servicedocs247@gmail.com"),
            ("EKH26T", "Shahidul Hasan", "2021-03-22", "19171859393", None, "466422371", "0432 932 183", "Otobigo247@gmail.com"),
            ("EEE61C", "Intisar Reza Abir", "2021-03-22", "19171859421", None, "468766961", "0468 353 271", "servicedocs247@gmail.com"),
            ("EMT21M", "Intisar Reza Abir", "2021-03-22", "19171859413", None, "421369546", "0481 330 527", "servicedocs247@gmail.com"),
        ]
        
        created = 0
        for plate, account, activation, tracker, old_sim, new_sim, phone, email in gps_data:
            vehicle = self.get_or_create_vehicle(plate)
            if not vehicle:
                continue
                
            gps, created_flag = GPSDevice.objects.update_or_create(
                plate_number=vehicle,
                defaults={
                    'account_name': account,
                    'activation_date': datetime.strptime(activation, '%Y-%m-%d').date() if activation else None,
                    'new_tracker_no': str(tracker) if tracker else None,
                    'new_sim_no': new_sim,
                    'phone_number': phone,
                    'email_address': email,
                    'provider': 'Seeworld WhatsGPS'
                }
            )
            if created_flag:
                created += 1
        
        self.stdout.write(f'  ✅ GPS Devices: {created} created, total: {GPSDevice.objects.count()}')

    def import_service_records(self):
        self.stdout.write('\n🔧 Importing service records...')
        
        # IMPORTANT: This uses ONLY fields that exist in your model
        service_data = [
            ("EDG81B", "Ounce Fuesaina", 403244, 406826, "416826km", None, "2026-04-28", None, "Automediks"),
            ("EDG81H", "Peter Mutahi Ndun'gu", 169361, 166000, "30,000km", "2026-03-30", "2026-03-24", "SERVICE DUE SOON", "From mail on 17.01.2026"),
            ("EEE61F", "Shalom-Lynn E KERESOMA", 262757, 0, None, None, "2026-02-13", None, "Updated From Last Photo"),
            ("EEE61C", "Warren falconer", 187993, 197000, None, None, "2025-07-30", "High priority", "30.03.2025"),
            ("CG38AY", "Glynnis Sinaki", 223370, 0, None, None, "2026-02-13", None, "Updated From Last Photo"),
            ("FTE70L", "Harpreet singh", 237644, 246000, None, None, "2026-09-27", None, "27.02.2026"),
            ("FTE70M", "Karl Pahulu", 240000, 250000, None, None, "2026-04-19", None, "Automediks"),
            ("EKH26T", "Mitieli Seru Vulaono", 139584, 140000, None, None, "2026-06-26", None, "26.02.2026"),
            ("CK27DB", "Malcolm John MARTIN", 112620, 122080, None, None, "2026-08-06", None, "06.01.2026"),
            ("EMN83K", "Palolo Brown", 117673, 127000, None, None, "2026-09-27", None, "27.02.2026"),
            ("EMT21D", "Lusi Lamositele", 83924, 85000, None, None, "2026-04-07", None, "07.01.2026"),
            ("EMF33H", "Teresa Togagae Faanu", 98678, 104000, None, None, "2026-03-17", None, "17.12.2025"),
            ("EMT21M", "Angeli Dee LIM", 113643, 120000, None, None, "2026-03-05", None, "05.11.2025"),
            ("EMT21N", None, 224403, 225403, None, None, "2026-07-04", None, "Automediks"),
            ("EMT21P", "David Robert Ripley", 85739, 95000, None, None, "2025-12-14", None, "14.08.2025"),
            ("EMT21R", "Elizabeth Tuitupou", 130892, 140892, None, None, "2026-04-25", None, "Automediks"),
            ("EMT21S", "Paulo Tau", 133629, 116000, None, None, "2026-07-06", None, "06.03.2026"),
            ("DSF60R", "Siosifa Ipa Niuafu", 162000, 172000, None, None, "2026-03-18", None, "Automediks"),
            ("DF89SF", "Anetone POLAMALA", 156526, 166526, None, None, "2026-04-20", None, "Automediks"),
            ("EXT62S", "Temo Junior", 127000, 137000, None, None, "2025-03-05", None, "05.11.2024"),
            ("CM18SG", "Ratu Jona BAVADRA", 155008, 161812, None, None, "2025-04-01", None, "01.12.2024"),
            ("FLX87X", "Emosi TIKOIBARAVI", 60590, 70000, None, None, "2025-05-26", None, "26.01.2025"),
            ("FLP12S", "Shane Masia Faruk", 162500, 172500, None, None, "2025-04-24", None, "24.12.2024"),
            ("FRT82Y", "Temo Junior", 25444, 35444, None, None, None, None, "Automediks"),
        ]
        
        created = 0
        for plate, driver, current, next_service, schedule, completed, forecast, status, notes in service_data:
            vehicle = self.get_or_create_vehicle(plate)
            if not vehicle:
                continue
            
            # Convert empty strings to None for date fields
            completed_date = None
            if completed:
                try:
                    completed_date = datetime.strptime(completed, '%Y-%m-%d').date()
                except:
                    pass
            
            forecast_date = None
            if forecast:
                try:
                    forecast_date = datetime.strptime(forecast, '%Y-%m-%d').date()
                except:
                    pass
            
            service, created_flag = ServiceRecord.objects.update_or_create(
                plate_number=vehicle,
                driver_name=driver if driver else '',
                defaults={
                    'current_reading': current or 0,
                    'next_service_at': next_service or 0,
                    'schedule_service': schedule if schedule else '',
                    'completed_on': completed_date,
                    'forecasted_service': forecast_date,
                    'status': status if status else '',
                    'notes': notes if notes else '',
                }
            )
            if created_flag:
                created += 1
        
        self.stdout.write(f'  ✅ Service Records: {created} created, total: {ServiceRecord.objects.count()}')

    def import_offences(self):
        self.stdout.write('\n🚨 Importing toll offences...')
        
        offences_data = [
            ("6111253363", "Motor vehicle exceed speed limit", "EDG81C", "2022-11-19", "2023-02-10", "Shahil Ronesh Chandra", "23320450"),
            ("6111052036", "Motor vehicle exceed speed limit", "CF16JX", "2022-11-07", "2023-02-03", "Sitiveni Keila I kalefonia teekiu", "57403"),
            ("1664760222", "Driver use mobile phone", "EEE61F", "2022-11-01", "2023-01-25", "Shalom-Lynn E KERESOMA", "22623915"),
            ("7127482488", "Proceed through red traffic light", "DSF60R", "2022-10-30", "2023-01-20", "Siosifa Ipa Niuafu ILANGANA", "22280207"),
            ("7127435307", "Proceed through red traffic light - School Zone", "EDG81C", "2022-10-18", "2023-01-13", "Shahil Ronesh Chandra", "23320450"),
        ]
        
        created = 0
        for pn, offence, rego, offence_date, maturity, driver, licence in offences_data:
            if not pn:
                continue
                
            offence_obj, created_flag = TollOffence.objects.update_or_create(
                penalty_notice_number=pn,
                defaults={
                    'offence': offence,
                    'vehicle_rego': rego,
                    'offence_date': datetime.strptime(offence_date, '%Y-%m-%d').date(),
                    'maturity_date': datetime.strptime(maturity, '%Y-%m-%d').date() if maturity else None,
                    'driver_name': driver,
                    'driver_licence_no': licence,
                    'status': 'outstanding',
                }
            )
            if created_flag:
                created += 1
        
        self.stdout.write(f'  ✅ Offences: {created} created, total: {TollOffence.objects.count()}')

    def import_install_status(self):
        self.stdout.write('\n📱 Importing install status...')
        
        install_data = [
            ("EMT21M", "Angeli Dee LIM", "353994713626882", "amaysim", "INV-0380", "2025-08-16", "completed"),
            ("EDG81H", "Peter Mutahi Ndun'gu", "353994713626841", "amaysim", "INV-0381", "2025-08-16", "completed"),
            ("EXT62S", "Temo Junior", "353994713628185", "amaysim", "INV-0455", "2025-09-13", "completed"),
            ("FLX87X", "Emosi TIKOIBARAVI", "353994713625231", "amaysim", "INV-0368", "2025-08-02", "completed"),
        ]
        
        created = 0
        for plate, driver, tracker, sim_brand, invoice, install_date, status in install_data:
            vehicle = self.get_or_create_vehicle(plate)
            if not vehicle:
                continue
            
            install, created_flag = InstallStatus.objects.update_or_create(
                plate_number=vehicle,
                driver_name=driver,
                defaults={
                    'tracker_number': tracker,
                    'sim_brand': sim_brand,
                    'invoice_number': invoice,
                    'install_date': datetime.strptime(install_date, '%Y-%m-%d').date() if install_date else None,
                    'status': status,
                }
            )
            if created_flag:
                created += 1
        
        self.stdout.write(f'  ✅ Install Status: {created} created, total: {InstallStatus.objects.count()}')

    def import_claims(self):
        self.stdout.write('\n📋 Importing insurance claims...')
        
        claims_data = [
            ("EKH26T", "M096089048", "2017 TOYOTA CAMRY", "2025-04-04", "Damage Whilst Parked", "In Progress"),
            ("EEE61F", "M083128717", "2019 TOYOTA CAMRY", "2023-09-30", "Damage Whilst Parked", "Complete"),
            ("EDG81C", "M071120523", "2019 TOYOTA CAMRY", "2022-02-17", "Damage Whilst Driven", "Complete"),
        ]
        
        created = 0
        for rego, claim_no, coverage, event_date, happened, progress in claims_data:
            if not claim_no:
                continue
            
            claim, created_flag = Claim.objects.update_or_create(
                claim_number=claim_no,
                defaults={
                    'vehicle_rego': rego,
                    'coverage': coverage,
                    'event_date': datetime.strptime(event_date, '%Y-%m-%d').date(),
                    'what_happened': happened,
                    'progress': progress,
                }
            )
            if created_flag:
                created += 1
        
        self.stdout.write(f'  ✅ Claims: {created} created, total: {Claim.objects.count()}')