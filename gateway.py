import requests

URL = "https://sjxaexssraavijbysqsd.supabase.co/functions/v1/sensor-data"

HEADERS = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeGFleHNzcmFhdmlqYnlzcXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODYyMjgsImV4cCI6MjA5MDA2MjIyOH0.Rvact_njjT4wNWnSBKuFI_5saHMiQrDnUUi9r9GMmKA",
    "Authorization": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeGFleHNzcmFhdmlqYnlzcXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODYyMjgsImV4cCI6MjA5MDA2MjIyOH0.Rvact_njjT4wNWnSBKuFI_5saHMiQrDnUUi9r9GMmKA",
    "Content-Type": "application/json"
}

data = {
    "lat": -13.52,
    "lon": -71.97,
    "temperatura": 8.6,
    "humedad": 81,
    "humedad_suelo": 54,
    "device_id": "WILLAY001",
    "source": "raspberry"
}

r = requests.post(
    URL,
    json=data,
    headers=HEADERS
)

print(r.status_code)
print(r.text)