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

class Event {
  final String name;
  final Timestamp date;
  final String location;

  Event({required this.name, required this.date, required this.location});

  factory Event.fromFirestore(DocumentSnapshot doc) {
    Map<String, dynamic> data = doc.data() as Map<String, dynamic>;
    return Event(
      name: data['name'] ?? '',
      date: (data['date'] as Timestamp),
      location: data['location'] ?? '',
    );
  }
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
        // TODO localization with properties?
        title: const Text('Upcoming events'),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: firestoreService.getEvents(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            // TODO localization with properties?
            return const Center(child: Text('No events available'));
          } else if (snapshot.hasData) {
            List<Event> eventsList = snapshot.data!.docs.map((doc) => Event.fromFirestore(doc)).toList();;
            eventsList.sort((a, b) => a.date.compareTo(b.date));
            eventsList.removeWhere((element) => isBeforeToday(element.date));
            
            if (eventsList.isNotEmpty) {
              return ListView.builder(
                itemCount: eventsList.length,
                itemBuilder: (context, index) {
                  Event event = eventsList[index];
                  Timestamp timestamp = event.date;
                  String formattedDate = formatter.format(timestamp.toDate());
                  String title = "$formattedDate - ${event.location}";

                  DateTime eventDate = timestamp.toDate();
                  bool isToday = DateTime.now().year == eventDate.year &&
                               DateTime.now().month == eventDate.month &&
                               DateTime.now().day == eventDate.day;

                  Duration difference = eventDate.difference(DateTime.now());

                  return Card(
                    color: isToday ? const Color.fromARGB(255, 253, 55, 41) : null,
                    child: Column(
                      children: <Widget>[
                        ListTile(
                          title: Text(title),
                          subtitle: Text(event.name),
                          leading: const Icon(Icons.event),
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.start,
                          children: <Widget>[
                            Padding(
                              padding: const EdgeInsets.all(8.0),
                              child: Text(difference.inDays > 0 ? "Tra ${difference.inDays} giorni" : "Oggi")
                            )
                          ],
                        ),
                      ],
                    )
                  );
                },
              );
            } else {
              return const Card(
                child: Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Align(
                    alignment: Alignment.center,
                    child: Text("Non ci sono eventi per adesso :)"),
                  )
                ),
              );
            }
          } else {
            return const Card(
              child: Padding(
                padding: EdgeInsets.all(16.0),
                child: Align(
                  alignment: Alignment.center,
                  child: Text("Non ci sono eventi"),
                )
              ),
            );
          }
        },
      )
    );
  }
}