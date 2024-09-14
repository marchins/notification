# San Siro Events Alert

## APP
Mobile app for iOS and Android that shows upcoming events (football matches and concerts) at locations in Milano San Siro area:  
For now locations included are:
- San Siro Stadium  
- Ippodromo La Maura  
- Ippodromo San Siro  

## Backend
Firebase Firestore and FCM Push Notifications  
Push notification system allows the users to be warned the day before the event  
Scheduled Cloud function scrapes location's websites looking for new events

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
flutter build ios  --release  
