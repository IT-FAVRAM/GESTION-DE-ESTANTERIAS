# Notifications Pending Index

Query used by forklift pending counter:

```ts
db.collection('notifications')
  .where('targetRole', '==', 'CARRETILLERO')
  .where('type', '==', 'request_material')
  .where('status', '==', 'PENDING')
  .orderBy('timestamp', 'desc')
```

Recommended composite index:

- Collection: `notifications`
- Fields (in order):
  1. `targetRole` Ascending
  2. `type` Ascending
  3. `status` Ascending
  4. `timestamp` Descending
