import 'dart:developer';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'homepage.dart';
import 'src/firebase_options.dart';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  final firebaseMessaging = FirebaseMessaging.instance;

  final FirebaseFirestore firestore = FirebaseFirestore.instance;
  final FirebaseAuth auth = FirebaseAuth.instance;

  syncDeviceToken();

  await firebaseMessaging.requestPermission(
    alert: true,
    announcement: false,
    badge: true,
    carPlay: false,
    criticalAlert: false,
    provisional: false,
    sound: true,
  );

  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  runApp(MyApp());
}

Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
    await Firebase.initializeApp();
    print("Handling a background message: ${message.messageId}");
  }

Future<bool> doesTokenAlreadyExist(String token) async {
  final QuerySnapshot result = await FirebaseFirestore.instance
      .collection('fcmTokens')
      .where('fcmToken', isEqualTo: token)
      .limit(1)
      .get();
  final List<DocumentSnapshot> documents = result.docs;
  return documents.length == 1;
}

Future<void> syncDeviceToken() async {
  String? fcmToken = await FirebaseMessaging.instance.getToken();
  print('Token $fcmToken');
  // final userId = FirebaseAuth.instance.currentUser!.uid;
  // const userId = "ZBY3XD8xtCHDVfWNVOL6";

  bool alreadyExsists = await doesTokenAlreadyExist(fcmToken!);
  if (!alreadyExsists) {
    log("Token not present");
    await FirebaseFirestore.instance
        .collection('fcmTokens')
        .doc(fcmToken)
        .set({'fcmToken': fcmToken, 'updatedOn': DateTime.now()});
  } else {
    log("Token already saved");
  }
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Eventi',
      home: HomePage(),
    );
  }
}
