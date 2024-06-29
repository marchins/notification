import 'package:cloud_firestore/cloud_firestore.dart';

class FirestoreService {

  final eventsCollection = FirebaseFirestore.instance.collection('events');

  Stream<QuerySnapshot> getEvents() {
    final eventsStream = eventsCollection.orderBy('date', descending: false).snapshots();
    return eventsStream;
  }

}