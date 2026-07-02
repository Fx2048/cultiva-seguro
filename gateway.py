import requests

url = "https://sjxaexssraavijbysqsd.supabase.co/functions/v1/sensor-data"

headers = {
    "apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeGFleHNzcmFhdmlqYnlzcXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODYyMjgsImV4cCI6MjA5MDA2MjIyOH0.Rvact_njjT4wNWnSBKuFI_5saHMiQrDnUUi9r9GMmKA",
    "Authorization":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeGFleHNzcmFhdmlqYnlzcXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODYyMjgsImV4cCI6MjA5MDA2MjIyOH0.Rvact_njjT4wNWnSBKuFI_5saHMiQrDnUUi9r9GMmKA",
    "Content-Type":"application/json"
}

data = {

    "lat":-13.52,
    "lon":-71.97,

    "temperatura":11.8,
    "humedad":82,

    "humedad_suelo":46,

    "device_id":"EMI001",

    "source":"raspberry"

}

r=requests.post(url,json=data,headers=headers)

print(r.text)
