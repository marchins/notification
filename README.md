# San Siro Events Alert

Mobile app for iOS and Android that shows upcoming events (football matches and concerts) at locations in Milano San Siro area:  
San Siro Stadium  
Ippodromo La Maura  
Ippordomo San Siro  
Push notification the day before the event alerts the users  

## Getting started
nvm use 20  
npm run lint  
npm run lint -- --fix  

## Functions
firebase deploy --only functions  
firebase deploy --only functions:scheduleNotification  

## App
# Android
flutter build apk --release  
# iOS 
flutter build ios  
