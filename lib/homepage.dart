import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:notification/services/firestore.dart';
import 'package:intl/intl.dart';


class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final FirestoreService firestoreService = FirestoreService();

  final DateFormat formatter = DateFormat('yyyy-MM-dd');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Prossimi eventi'),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: firestoreService.getEvents(),
        builder: (context, snapshot) {
          if (snapshot.hasData) {
            List eventsList = snapshot.data!.docs;
            eventsList.sort((a, b) => a.data()['date'].compareTo(b.data()['date']));
            return ListView.builder(
              itemCount: eventsList.length,
              itemBuilder: (context, index) {
                DocumentSnapshot doc = eventsList[index];
                String docID = doc.id;
                Map<String, dynamic> data = doc.data() as Map<String, dynamic>;
                Timestamp timestamp = data['date'];
                String formattedDate = formatter.format(timestamp.toDate());
                String eventText = data['name'] + ': ' + formattedDate;
 
                return ListTile(
                  title: Text(eventText),
                  subtitle: Text(data['location']),
                );

              },
            );
          }
          else {
            return const Text("NO DATA");
          }
        },
      ),
    );
  }
}