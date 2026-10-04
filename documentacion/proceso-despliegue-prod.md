## Este es el proceso a seguir una vez se hayan realizados cambios en main para volver a desplegar en el droplet de DO

cd /home/dental-test/ClinicApp
git pull
cd front
npm ci
npm run build
sudo rm -rf /var/www/clinicapp/*
sudo cp -r dist/. /var/www/clinicapp/
sudo chown -R www-data:www-data /var/www/clinicapp


#### Estas sentencias son para validar si se levantó de manera correcta

uname -r                      # debería mostrar 6.8.0-146-generic
systemctl is-active nginx     # debería decir active
free -h                       # el swap debería mostrar 2.0Gi
curl -s http://localhost | grep -o "<title>.*</title>"