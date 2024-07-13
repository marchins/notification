import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:notification/services/firestore.dart';
import 'package:intl/intl.dart';

final FirestoreService firestoreService = FirestoreService();
final DateFormat formatter = DateFormat('dd MMMM yyyy');

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: ThemeData(useMaterial3: true),
      home: const ListTileWidget(),
    );
  }
}

class ListTileWidget extends StatelessWidget {
  
  const ListTileWidget({super.key});

  bool isBeforeToday(Timestamp timestamp) {
    DateTime now = DateTime.now().toUtc();
    DateTime today = DateTime.utc(now.year, now.month, now.day); // Inizio di oggi in UTC
    DateTime dateToCheck = DateTime.fromMillisecondsSinceEpoch(
      timestamp.millisecondsSinceEpoch,
      isUtc: false,
    ).toUtc();
    DateTime dateOnly = DateTime.utc(dateToCheck.year, dateToCheck.month, dateToCheck.day); // Inizio del giorno da verificare in UTC
    return dateOnly.isBefore(today);
}


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
            eventsList.removeWhere((element) => isBeforeToday(element.data()['date']));
            
            return ListView.builder(
              itemCount: eventsList.length,
              itemBuilder: (context, index) {
                DocumentSnapshot doc = eventsList[index];
                //String docID = doc.id;
                Map<String, dynamic> data = doc.data() as Map<String, dynamic>;
                Timestamp timestamp = data['date'];
                String formattedDate = formatter.format(timestamp.toDate());
                String title = "$formattedDate - ${data['location']}";
                String subtitle = data['name'];

                return Card(
                  child: ListTile(
                    title: Text(title),
                    subtitle: Text(subtitle),
                    leading: Icon(Icons.event),
                  ),
                );
              },
            );
          }
          else {
            return const Text("NO DATA");
          }
        },
      )
    );
  }
}