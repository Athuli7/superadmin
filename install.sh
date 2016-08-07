echo "SuperAdmin Installtion"
echo "Installion assumes a clean install of Ubuntu 14.04"
echo "Installion pormpts are for creating a subdomain 'superadmin for a domain name 'domain.tld' and accessing superadmin via it"
echo "you wil be prompted to provide both."
echo "By default, a cer-key pair is generated using OpenSSL for HTTPS, if HTTPS is enabled"
echo "You can find the cer-key pair in the /etc/ssl/<domain>/ folder."
echo "You will be promted to enter details for the certificate"

# Root check
if [[ $EUID -ne 0 ]]; then
  echo "You must be a root user" 2>&1
  exit 1
fi

#User Consent
echo "This setup requires the installation of the nginx, nodejs and graphicsmagick packages using apt-get !"
read -p "Do you wish to permit this ? (y/n) : " userConsent

read -p "HTTP ? (y/n) : " httpEn
read -p "HTTPS ? (y/n) : " httpsEn

if [ "$userConsent" == "y" ]; then
#User Input
read -p "Domain (eg, domain.tk): " domain
read -p "Subdomain (eg, superadmin): " subdomain

if [ "$httpsEn" == "y" ]; then
read -p "Country Name (2 letter code) (eg, IN): " certC
read -p "State or Province Name (eg, Kerala): " certST
read -p "Locality Name (eg, Kochi): " certL
read -p "Organization Name (eg, Novocorp Industries Inc): " certO
read -p "Organizational Unit Name (RnD): " certOU
fi

#Prerequisits
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
apt-get install python-software-properties
apt-get install software-properties-common
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
apt-get update
apt-get install -y nginx
apt-get install -y nodejs
apt-get install -y graphicsmagick
curl https://get.acme.sh | sh
mkdir /www/
mkdir /www/logs/
mkdir /www/nginx/
mkdir /www/acme/
mkdir /www/ssl/
mkdir /www/www/
mkdir /www/node_modules/
cd /www/
npm install total.js@beta

#Key Generation

mkdir /etc/ssl/${domain}
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
-subj "/C=$certC/ST=$certST/L=$certL/O=$certO/OU=$certOU/CN=$subdomain.$domain" \
-keyout /etc/ssl/${domain}/${subdomain}.key \
-out /etc/ssl/${domain}/${subdomain}.cer

#Configuration
cd
apt-get install -y git
git clone https://github.com/totaljs/superadmin
mv superadmin /www/
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
cp /www/superadmin/nginx.conf /etc/nginx/nginx.conf
cp /www/superadmin/superadmin.conf /www/nginx/
repexp=s/#domain#/$domain/g
subrepexp=s/#subdomain#/$subdomain/g
httpenexp=s/#disablehttp#//g
httpsenexp=s/#disablehttps#//g

if [ "$httpEn" == "y" ]; then
sed -i -e $httpenexp /www/nginx/superadmin.conf
fi
if [ "$httpsEn" == "y" ]; then
sed -i -e $httpsenexp /www/nginx/superadmin.conf
fi

sed -i -e $repexp /www/nginx/superadmin.conf
sed -i -e $subrepexp /www/nginx/superadmin.conf
service nginx reload

#Starting
cd /www/superadmin
node --nouse-idle-notification --expose-gc --max_inlined_source_size=1200 release.js 9999 > superadmin.log &

else
echo "Sorry, this installation cannot continue."
fi