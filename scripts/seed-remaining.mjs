const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function insert(table, rows) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table} failed: ${res.status} ${body}`);
  }
  console.log(`OK ${table}: ${rows.length} rows`);
}

const vehicles = [
  { id:"aaaaaaaa-0000-0000-0000-000000000001", make:"Lamborghini", model:"Huracán", trim:"EVO Spyder", year:2023, category:"exotic", vin:"ZA9HU45B4LLA12001", exterior_color:"Arancio Borealis", interior_color:"Black Alcantara", seats:2, doors:2, transmission:"automatic", fuel_type:"gasoline", horsepower:640, drivetrain:"RWD", description:"The Lamborghini Huracán EVO Spyder combines 640 horsepower with an open-air experience. The 5.2L naturally aspirated V10 delivers a visceral soundtrack unlike any turbocharged competitor.", daily_price:1200.00, weekly_price:7500.00, monthly_price:24000.00, deposit_amount:5000.00, mileage_limit:150, extra_mileage_price:5.00, min_rental_days:1, status:"available", is_featured:true },
  { id:"aaaaaaaa-0000-0000-0000-000000000002", make:"Ferrari", model:"488", trim:"Spider", year:2022, category:"exotic", vin:"ZFF79ALA4J0238002", exterior_color:"Rosso Corsa", interior_color:"Beige Leather", seats:2, doors:2, transmission:"automatic", fuel_type:"gasoline", horsepower:710, drivetrain:"RWD", description:"The Ferrari 488 Spider blends 710hp twin-turbo V8 performance with drop-top freedom. Mid-engine balance and Ferrari's magnetic ride suspension make it as capable as it is stunning.", daily_price:1100.00, weekly_price:6800.00, monthly_price:22000.00, deposit_amount:5000.00, mileage_limit:150, extra_mileage_price:5.00, min_rental_days:1, status:"available", is_featured:true },
  { id:"aaaaaaaa-0000-0000-0000-000000000003", make:"McLaren", model:"720S", trim:"Spider", year:2023, category:"exotic", vin:"SBM14DCA7LW003003", exterior_color:"Papaya Spark", interior_color:"Carbon Black", seats:2, doors:2, transmission:"automatic", fuel_type:"gasoline", horsepower:710, drivetrain:"RWD", description:"The McLaren 720S Spider delivers 710hp from a 4.0L twin-turbo V8. The electrochromic glass roof transforms from transparent to opaque at the touch of a button.", daily_price:1350.00, weekly_price:8500.00, monthly_price:27000.00, deposit_amount:5000.00, mileage_limit:200, extra_mileage_price:6.00, min_rental_days:1, status:"available", is_featured:true },
  { id:"aaaaaaaa-0000-0000-0000-000000000004", make:"Porsche", model:"911", trim:"Turbo S Cabriolet", year:2023, category:"sports", vin:"WP0CB2A92PS004004", exterior_color:"Chalk Grey", interior_color:"Black/Chalk", seats:4, doors:2, transmission:"automatic", fuel_type:"gasoline", horsepower:650, drivetrain:"AWD", description:"The 911 Turbo S Cabriolet is Porsche's pinnacle open-air sports car. 650hp, 0-60 in 2.6 seconds, and everyday usability that no other exotic can match.", daily_price:650.00, weekly_price:4100.00, monthly_price:13000.00, deposit_amount:3000.00, mileage_limit:200, extra_mileage_price:4.00, min_rental_days:1, status:"available", is_featured:true },
  { id:"aaaaaaaa-0000-0000-0000-000000000005", make:"BMW", model:"M8", trim:"Competition Gran Coupé", year:2023, category:"sports", vin:"WBS83AH08NCB05005", exterior_color:"Frozen Black", interior_color:"Merino Full Leather", seats:4, doors:4, transmission:"automatic", fuel_type:"gasoline", horsepower:617, drivetrain:"AWD", description:"The M8 Competition Gran Coupé pairs 617hp twin-turbo V8 performance with genuine four-seat practicality and BMW's most advanced technology suite.", daily_price:480.00, weekly_price:3000.00, monthly_price:9500.00, deposit_amount:2500.00, mileage_limit:250, extra_mileage_price:3.00, min_rental_days:1, status:"available", is_featured:false },
  { id:"aaaaaaaa-0000-0000-0000-000000000006", make:"Aston Martin", model:"DB11", trim:"Volante", year:2022, category:"sports", vin:"SCFRMFCV8NGT06006", exterior_color:"Midnight Blue", interior_color:"Tan Bridge of Weir", seats:4, doors:2, transmission:"automatic", fuel_type:"gasoline", horsepower:503, drivetrain:"RWD", description:"The DB11 Volante is Aston Martin's grand touring convertible. 503hp twin-turbo V8, hand-stitched interior, and a fabric roof that opens in 14 seconds.", daily_price:720.00, weekly_price:4500.00, monthly_price:14500.00, deposit_amount:3500.00, mileage_limit:200, extra_mileage_price:4.00, min_rental_days:2, status:"available", is_featured:true },
  { id:"aaaaaaaa-0000-0000-0000-000000000007", make:"Range Rover", model:"Range Rover", trim:"Autobiography LWB", year:2023, category:"suv", vin:"SALGS2SE5PA107007", exterior_color:"Santorini Black", interior_color:"Ebony/Ivory Semi-Aniline", seats:7, doors:4, transmission:"automatic", fuel_type:"gasoline", horsepower:523, drivetrain:"AWD", description:"The Range Rover Autobiography LWB defines luxury SUV travel. Executive rear seating, 523hp supercharged V8, and legendary off-road capability wrapped in genuine Connolly leather.", daily_price:380.00, weekly_price:2400.00, monthly_price:7500.00, deposit_amount:2000.00, mileage_limit:300, extra_mileage_price:2.50, min_rental_days:1, status:"available", is_featured:true },
  { id:"aaaaaaaa-0000-0000-0000-000000000008", make:"Mercedes-Benz", model:"G 63", trim:"AMG", year:2023, category:"suv", vin:"WDCYC7HH4PX308008", exterior_color:"Obsidian Black", interior_color:"Black Nappa Leather", seats:5, doors:4, transmission:"automatic", fuel_type:"gasoline", horsepower:577, drivetrain:"AWD", description:"The G 63 AMG is an icon reimagined. 577hp handcrafted AMG V8 biturbo in the most recognizable silhouette on the road. Three locking differentials meet Nappa leather.", daily_price:420.00, weekly_price:2650.00, monthly_price:8200.00, deposit_amount:2500.00, mileage_limit:250, extra_mileage_price:3.00, min_rental_days:1, status:"available", is_featured:false },
  { id:"aaaaaaaa-0000-0000-0000-000000000009", make:"Cadillac", model:"Escalade", trim:"Platinum Sport", year:2024, category:"suv", vin:"1GYS4PKL2PR409009", exterior_color:"Shadow Metallic", interior_color:"Whisper Beige", seats:8, doors:4, transmission:"automatic", fuel_type:"gasoline", horsepower:420, drivetrain:"AWD", description:"The Escalade Platinum Sport redefines American luxury. 420hp 6.2L V8, curved OLED display spanning 38 inches, and magnetic ride control for a commanding yet smooth ride.", daily_price:320.00, weekly_price:2000.00, monthly_price:6200.00, deposit_amount:1500.00, mileage_limit:350, extra_mileage_price:2.00, min_rental_days:1, status:"available", is_featured:false },
  { id:"aaaaaaaa-0000-0000-0000-000000000010", make:"Bentley", model:"Continental GTC", trim:"Speed", year:2023, category:"convertible", vin:"SCBCR23W8EC010010", exterior_color:"Beluga", interior_color:"Linen/Black Hide", seats:4, doors:2, transmission:"automatic", fuel_type:"gasoline", horsepower:650, drivetrain:"AWD", description:"The Continental GTC Speed is the fastest Bentley convertible ever made. 650hp W12, 208mph top speed, and a Mulliner-appointed cabin that redefines open-air grand touring.", daily_price:950.00, weekly_price:5900.00, monthly_price:19000.00, deposit_amount:4000.00, mileage_limit:200, extra_mileage_price:5.00, min_rental_days:2, status:"available", is_featured:true },
  { id:"aaaaaaaa-0000-0000-0000-000000000011", make:"Rolls-Royce", model:"Ghost", trim:"Black Badge", year:2023, category:"executive", vin:"SCA664S5XPU011011", exterior_color:"Black", interior_color:"Black/Mandarin", seats:5, doors:4, transmission:"automatic", fuel_type:"gasoline", horsepower:591, drivetrain:"AWD", description:"The Ghost Black Badge is Rolls-Royce for those who forge their own path. 591hp twin-turbo V12, self-levelling air suspension, and a Starlight Headliner with 1,340 individual fiber optic stars.", daily_price:1500.00, weekly_price:9500.00, monthly_price:30000.00, deposit_amount:6000.00, mileage_limit:100, extra_mileage_price:8.00, min_rental_days:3, status:"available", is_featured:true },
  { id:"aaaaaaaa-0000-0000-0000-000000000012", make:"Tesla", model:"Model S", trim:"Plaid", year:2024, category:"electric", vin:"5YJSA1E68PF012012", exterior_color:"Midnight Silver", interior_color:"Black/White", seats:5, doors:4, transmission:"automatic", fuel_type:"electric", horsepower:1020, drivetrain:"AWD", description:"The Tesla Model S Plaid delivers 1,020hp and 0-60 in 1.99 seconds — the quickest production car ever made. Range of 396 miles, Full Self-Driving capability, and a 17-inch cinematic display.", daily_price:290.00, weekly_price:1800.00, monthly_price:5600.00, deposit_amount:1500.00, mileage_limit:null, extra_mileage_price:0.00, min_rental_days:1, status:"available", is_featured:false },
];

const v = (n) => `aaaaaaaa-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;

const features = [
  [1, "Carbon Ceramic Brakes"], [1, "Sport Exhaust"], [1, "Lifting Front Axle"], [1, "Apple CarPlay"], [1, "Backup Camera"],
  [2, "Rear-View Camera"], [2, "Carbon Fiber Package"], [2, "Racing Seats"], [2, "Apple CarPlay"],
  [3, "Electrochromic Roof"], [3, "Variable Drift Control"], [3, "MSO Bespoke Audio"], [3, "Track Telemetry"],
  [4, "PDCC Sport"], [4, "Burmester Audio"], [4, "Night Vision"], [4, "Massaging Seats"],
  [7, "Meridian Sound System"], [7, "Air Suspension"], [7, "Massage Seats"], [7, "Panoramic Roof"], [7, "Executive Rear Seating"],
  [11, "Starlight Headliner"], [11, "Spirit of Ecstasy"], [11, "Bespoke Audio"], [11, "Lambswool Floor Mats"],
  [12, "Full Self-Driving"], [12, "Autopilot"], [12, "Supercharging"], [12, "Gaming"], [12, "Premium Audio"],
].map(([n, feature]) => ({ vehicle_id: v(n), feature }));

const locations = [
  [1, "Wabs Beverly Hills", "9560 Wilshire Blvd", "Beverly Hills", "CA", "90212", true, 150.00],
  [2, "Wabs Beverly Hills", "9560 Wilshire Blvd", "Beverly Hills", "CA", "90212", true, 150.00],
  [3, "Wabs Beverly Hills", "9560 Wilshire Blvd", "Beverly Hills", "CA", "90212", true, 150.00],
  [4, "Wabs Malibu", "22000 Pacific Coast Hwy", "Malibu", "CA", "90265", true, 200.00],
  [5, "Wabs Beverly Hills", "9560 Wilshire Blvd", "Beverly Hills", "CA", "90212", false, 0.00],
  [6, "Wabs Malibu", "22000 Pacific Coast Hwy", "Malibu", "CA", "90265", true, 200.00],
  [7, "Wabs Beverly Hills", "9560 Wilshire Blvd", "Beverly Hills", "CA", "90212", true, 150.00],
  [8, "Wabs Beverly Hills", "9560 Wilshire Blvd", "Beverly Hills", "CA", "90212", true, 150.00],
  [9, "Wabs LAX", "1 World Way", "Los Angeles", "CA", "90045", false, 0.00],
  [10, "Wabs Malibu", "22000 Pacific Coast Hwy", "Malibu", "CA", "90265", true, 200.00],
  [11, "Wabs Beverly Hills", "9560 Wilshire Blvd", "Beverly Hills", "CA", "90212", true, 250.00],
  [12, "Wabs LAX", "1 World Way", "Los Angeles", "CA", "90045", false, 0.00],
].map(([n, name, address, city, state, zip, delivery_available, delivery_fee]) => ({
  vehicle_id: v(n), name, address, city, state, zip, delivery_available, delivery_fee,
}));

await insert("vehicles", vehicles);
await insert("vehicle_features", features);
await insert("vehicle_locations", locations);
