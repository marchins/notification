# San Siro Events Alert

Mobile app for iOS and Android that shows upcoming events (football matches and concerts) at locations in Milano San Siro area:  
- San Siro Stadium  
- Ippodromo La Maura  
- Ippodromo San Siro  
Push notification system allows the users to be warned the day before the event  

## Getting started
nvm use 20  
npm run lint  
npm run lint -- --fix  

## Functions
firebase deploy --only functions  
firebase deploy --only functions:scheduleNotification  

## App
### Android
flutter build apk --release  
### iOS 
flutter build ios  
