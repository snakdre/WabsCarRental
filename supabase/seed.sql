-- ============================================================
-- WABS CAR RENTAL — DEMO SEED DATA
-- Run AFTER migrations. Creates test users via Supabase auth API.
-- ============================================================

-- NOTE: Create these users in Supabase Auth dashboard or via CLI first:
-- customer@wabs.com / WabsDemo2024!  → copy UUID → replace CUSTOMER_UUID below
-- manager@wabs.com  / WabsDemo2024!  → copy UUID → replace MANAGER_UUID below
-- admin@wabs.com    / WabsDemo2024!  → copy UUID → replace ADMIN_UUID below
-- Then run this SQL in Supabase SQL Editor with the real UUIDs substituted.

-- Set roles (profiles are auto-created by trigger)
-- UPDATE roles SET role = 'manager' WHERE user_id = 'MANAGER_UUID';
-- UPDATE roles SET role = 'admin'   WHERE user_id = 'ADMIN_UUID';

-- Protection Plans
INSERT INTO protection_plans (id, name, description, daily_price, coverage_details) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Basic Shield', 'Covers minor damage up to $2,500 deductible', 29.00, 'Collision damage waiver. $2,500 deductible. Excludes tires, glass, and underbody.'),
  ('11111111-0000-0000-0000-000000000002', 'Premium Guard', 'Full coverage with $500 deductible', 59.00, 'Collision + comprehensive. $500 deductible. Includes tires and glass.'),
  ('11111111-0000-0000-0000-000000000003', 'Elite Zero', 'Zero deductible complete coverage', 99.00, 'Zero deductible. Full collision, comprehensive, tires, glass, and roadside assistance.');

-- Extras
INSERT INTO extras (id, name, description, price, unit) VALUES
  ('22222222-0000-0000-0000-000000000001', 'GPS Navigation', 'Premium Garmin GPS system', 15.00, 'per_day'),
  ('22222222-0000-0000-0000-000000000002', 'Child Safety Seat', 'Certified infant or toddler seat', 12.00, 'per_day'),
  ('22222222-0000-0000-0000-000000000003', 'Professional Chauffeur', 'Licensed professional driver', 150.00, 'per_day'),
  ('22222222-0000-0000-0000-000000000004', 'Pre-paid Fuel', 'Return the vehicle on empty', 85.00, 'flat'),
  ('22222222-0000-0000-0000-000000000005', 'Airport Transfer', 'One-way airport pickup or dropoff', 95.00, 'flat');

-- Promo Codes
INSERT INTO promo_codes (code, type, value, max_uses, expires_at) VALUES
  ('WABS10', 'percentage', 10.00, 100, NOW() + INTERVAL '1 year'),
  ('LUXURY50', 'fixed', 50.00, 50, NOW() + INTERVAL '6 months');

-- Vehicles
INSERT INTO vehicles (id, make, model, trim, year, category, vin, exterior_color, interior_color, seats, doors, transmission, fuel_type, horsepower, drivetrain, description, daily_price, weekly_price, monthly_price, deposit_amount, mileage_limit, extra_mileage_price, min_rental_days, status, is_featured) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Lamborghini','Huracán','EVO Spyder',2023,'exotic','ZA9HU45B4LLA12001','Arancio Borealis','Black Alcantara',2,2,'automatic','gasoline',640,'RWD','The Lamborghini Huracán EVO Spyder combines 640 horsepower with an open-air experience. The 5.2L naturally aspirated V10 delivers a visceral soundtrack unlike any turbocharged competitor.',1200.00,7500.00,24000.00,5000.00,150,5.00,1,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000002','Ferrari','488','Spider',2022,'exotic','ZFF79ALA4J0238002','Rosso Corsa','Beige Leather',2,2,'automatic','gasoline',710,'RWD','The Ferrari 488 Spider blends 710hp twin-turbo V8 performance with drop-top freedom. Mid-engine balance and Ferrari''s magnetic ride suspension make it as capable as it is stunning.',1100.00,6800.00,22000.00,5000.00,150,5.00,1,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000003','McLaren','720S','Spider',2023,'exotic','SBM14DCA7LW003003','Papaya Spark','Carbon Black',2,2,'automatic','gasoline',710,'RWD','The McLaren 720S Spider delivers 710hp from a 4.0L twin-turbo V8. The electrochromic glass roof transforms from transparent to opaque at the touch of a button.',1350.00,8500.00,27000.00,5000.00,200,6.00,1,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000004','Porsche','911','Turbo S Cabriolet',2023,'sports','WP0CB2A92PS004004','Chalk Grey','Black/Chalk',4,2,'automatic','gasoline',650,'AWD','The 911 Turbo S Cabriolet is Porsche''s pinnacle open-air sports car. 650hp, 0-60 in 2.6 seconds, and everyday usability that no other exotic can match.',650.00,4100.00,13000.00,3000.00,200,4.00,1,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000005','BMW','M8','Competition Gran Coupé',2023,'sports','WBS83AH08NCB05005','Frozen Black','Merino Full Leather',4,4,'automatic','gasoline',617,'AWD','The M8 Competition Gran Coupé pairs 617hp twin-turbo V8 performance with genuine four-seat practicality and BMW''s most advanced technology suite.',480.00,3000.00,9500.00,2500.00,250,3.00,1,'available',false),
  ('aaaaaaaa-0000-0000-0000-000000000006','Aston Martin','DB11','Volante',2022,'sports','SCFRMFCV8NGT06006','Midnight Blue','Tan Bridge of Weir',4,2,'automatic','gasoline',503,'RWD','The DB11 Volante is Aston Martin''s grand touring convertible. 503hp twin-turbo V8, hand-stitched interior, and a fabric roof that opens in 14 seconds.',720.00,4500.00,14500.00,3500.00,200,4.00,2,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000007','Range Rover','Range Rover','Autobiography LWB',2023,'suv','SALGS2SE5PA107007','Santorini Black','Ebony/Ivory Semi-Aniline',7,4,'automatic','gasoline',523,'AWD','The Range Rover Autobiography LWB defines luxury SUV travel. Executive rear seating, 523hp supercharged V8, and legendary off-road capability wrapped in genuine Connolly leather.',380.00,2400.00,7500.00,2000.00,300,2.50,1,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000008','Mercedes-Benz','G 63','AMG',2023,'suv','WDCYC7HH4PX308008','Obsidian Black','Black Nappa Leather',5,4,'automatic','gasoline',577,'AWD','The G 63 AMG is an icon reimagined. 577hp handcrafted AMG V8 biturbo in the most recognizable silhouette on the road. Three locking differentials meet Nappa leather.',420.00,2650.00,8200.00,2500.00,250,3.00,1,'available',false),
  ('aaaaaaaa-0000-0000-0000-000000000009','Cadillac','Escalade','Platinum Sport',2024,'suv','1GYS4PKL2PR409009','Shadow Metallic','Whisper Beige',8,4,'automatic','gasoline',420,'AWD','The Escalade Platinum Sport redefines American luxury. 420hp 6.2L V8, curved OLED display spanning 38 inches, and magnetic ride control for a commanding yet smooth ride.',320.00,2000.00,6200.00,1500.00,350,2.00,1,'available',false),
  ('aaaaaaaa-0000-0000-0000-000000000010','Bentley','Continental GTC','Speed',2023,'convertible','SCBCR23W8EC010010','Beluga','Linen/Black Hide',4,2,'automatic','gasoline',650,'AWD','The Continental GTC Speed is the fastest Bentley convertible ever made. 650hp W12, 208mph top speed, and a Mulliner-appointed cabin that redefines open-air grand touring.',950.00,5900.00,19000.00,4000.00,200,5.00,2,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000011','Rolls-Royce','Ghost','Black Badge',2023,'executive','SCA664S5XPU011011','Black',  'Black/Mandarin',5,4,'automatic','gasoline',591,'AWD','The Ghost Black Badge is Rolls-Royce for those who forge their own path. 591hp twin-turbo V12, self-levelling air suspension, and a Starlight Headliner with 1,340 individual fiber optic stars.',1500.00,9500.00,30000.00,6000.00,100,8.00,3,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000012','Tesla','Model S','Plaid',2024,'electric','5YJSA1E68PF012012','Midnight Silver','Black/White',5,4,'automatic','electric',1020,'AWD','The Tesla Model S Plaid delivers 1,020hp and 0-60 in 1.99 seconds — the quickest production car ever made. Range of 396 miles, Full Self-Driving capability, and a 17-inch cinematic display.',290.00,1800.00,5600.00,1500.00,NULL,0.00,1,'available',false);

-- Vehicle Features
INSERT INTO vehicle_features (vehicle_id, feature) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Carbon Ceramic Brakes'),('aaaaaaaa-0000-0000-0000-000000000001','Sport Exhaust'),('aaaaaaaa-0000-0000-0000-000000000001','Lifting Front Axle'),('aaaaaaaa-0000-0000-0000-000000000001','Apple CarPlay'),('aaaaaaaa-0000-0000-0000-000000000001','Backup Camera'),
  ('aaaaaaaa-0000-0000-0000-000000000002','Rear-View Camera'),('aaaaaaaa-0000-0000-0000-000000000002','Carbon Fiber Package'),('aaaaaaaa-0000-0000-0000-000000000002','Racing Seats'),('aaaaaaaa-0000-0000-0000-000000000002','Apple CarPlay'),
  ('aaaaaaaa-0000-0000-0000-000000000003','Electrochromic Roof'),('aaaaaaaa-0000-0000-0000-000000000003','Variable Drift Control'),('aaaaaaaa-0000-0000-0000-000000000003','MSO Bespoke Audio'),('aaaaaaaa-0000-0000-0000-000000000003','Track Telemetry'),
  ('aaaaaaaa-0000-0000-0000-000000000004','PDCC Sport'),('aaaaaaaa-0000-0000-0000-000000000004','Burmester Audio'),('aaaaaaaa-0000-0000-0000-000000000004','Night Vision'),('aaaaaaaa-0000-0000-0000-000000000004','Massaging Seats'),
  ('aaaaaaaa-0000-0000-0000-000000000007','Meridian Sound System'),('aaaaaaaa-0000-0000-0000-000000000007','Air Suspension'),('aaaaaaaa-0000-0000-0000-000000000007','Massage Seats'),('aaaaaaaa-0000-0000-0000-000000000007','Panoramic Roof'),('aaaaaaaa-0000-0000-0000-000000000007','Executive Rear Seating'),
  ('aaaaaaaa-0000-0000-0000-000000000011','Starlight Headliner'),('aaaaaaaa-0000-0000-0000-000000000011','Spirit of Ecstasy'),('aaaaaaaa-0000-0000-0000-000000000011','Bespoke Audio'),('aaaaaaaa-0000-0000-0000-000000000011','Lambswool Floor Mats'),
  ('aaaaaaaa-0000-0000-0000-000000000012','Full Self-Driving'),('aaaaaaaa-0000-0000-0000-000000000012','Autopilot'),('aaaaaaaa-0000-0000-0000-000000000012','Supercharging'),('aaaaaaaa-0000-0000-0000-000000000012','Gaming'),('aaaaaaaa-0000-0000-0000-000000000012','Premium Audio');

-- Vehicle Locations
INSERT INTO vehicle_locations (vehicle_id, name, address, city, state, zip, delivery_available, delivery_fee) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,150.00),
  ('aaaaaaaa-0000-0000-0000-000000000002','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,150.00),
  ('aaaaaaaa-0000-0000-0000-000000000003','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,150.00),
  ('aaaaaaaa-0000-0000-0000-000000000004','Wabs Malibu','22000 Pacific Coast Hwy','Malibu','CA','90265',true,200.00),
  ('aaaaaaaa-0000-0000-0000-000000000005','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',false,0.00),
  ('aaaaaaaa-0000-0000-0000-000000000006','Wabs Malibu','22000 Pacific Coast Hwy','Malibu','CA','90265',true,200.00),
  ('aaaaaaaa-0000-0000-0000-000000000007','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,150.00),
  ('aaaaaaaa-0000-0000-0000-000000000008','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,150.00),
  ('aaaaaaaa-0000-0000-0000-000000000009','Wabs LAX','1 World Way','Los Angeles','CA','90045',false,0.00),
  ('aaaaaaaa-0000-0000-0000-000000000010','Wabs Malibu','22000 Pacific Coast Hwy','Malibu','CA','90265',true,200.00),
  ('aaaaaaaa-0000-0000-0000-000000000011','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,250.00),
  ('aaaaaaaa-0000-0000-0000-000000000012','Wabs LAX','1 World Way','Los Angeles','CA','90045',false,0.00);
