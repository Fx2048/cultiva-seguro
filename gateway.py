import requests

SUPABASE_URL = "https://sjxaexssraavijbysqsd.supabase.co/functions/v1/sensor-data"

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeGFleHNzcmFhdmlqYnlzcXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODYyMjgsImV4cCI6MjA5MDA2MjIyOH0.Rvact_njjT4wNWnSBKuFI_5saHMiQrDnUUi9r9GMmKA"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "lat": -13.1631,
    "lon": -72.5450,
    "temperatura": 12.5,
    "humedad": 80,
    "humedad_suelo": 45,
    "device_id": "EMI001",
    "source": "raspberry"
}

r = requests.post(
    SUPABASE_URL,
    headers=headers,
    json=payload
)

print(r.status_code)
print(r.text)
