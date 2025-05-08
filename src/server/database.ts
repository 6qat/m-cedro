import { createClient } from 'redis';

const client = createClient();

client.on('error', (err) => console.log('Redis Client Error', err));

await client.connect();

await client.set('key', 'value');
const value = await client.get('key');
console.log(value);

const _user1 = {
  name: 'Paul John',
  email: 'paul.john@example.com',
  age: 42,
  city: 'London',
};

const _user2 = {
  name: 'Eden Zamir',
  email: 'eden.zamir@example.com',
  age: 29,
  city: 'Tel Aviv',
};

const _user3 = {
  name: 'Paul Zamir',
  email: 'paul.zamir@example.com',
  age: 35,
  city: 'Tel Aviv',
};

// const [user1Reply, user2Reply, user3Reply] = await Promise.all([
//   client.json.set("user:1", "$.", user1),
//   client.json.set("user:2", "$.", user2),
//   client.json.set("user:3", "$.", user3),
// ]);

// const findPaulResult = await client.ft.search("idx:users", "Paul @age:[30 40]");

// console.log(findPaulResult.total); // >>> 1

// for (const doc of findPaulResult.documents) {
//   console.log(`ID: ${doc.id}, name: ${doc.value.name}, age: ${doc.value.age}`);
// }

const data = { name: 'John', age: 30, city: 'New York' };
client.set('mykey', JSON.stringify(data));

const value2 = await client.get('mykey');
console.log(value2);
