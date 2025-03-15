require('dotenv').config()
const { Kafka } = require('kafkajs')
const MongoClient = require('mongodb').MongoClient;

const kafka = new Kafka({
    clientId: 'transaction-client',
    brokers: [process.env.KAFKA_SERVER],
})

kafka_consumer()

async function kafka_consumer() {
    const consumer = kafka.consumer({ groupId: 'movement-subscription', allowAutoTopicCreation: true })
    await consumer.connect()
    await consumer.subscribe({ topic: 'transaction-topic', fromBeginning: true })
    await consumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
            console.log({ value: message.value.toString() })
            var jsonObj = JSON.parse(message.value.toString())
            var amountNew = 0
            console.log(jsonObj.type);
            if (jsonObj.type === 'withdrawal') {
                amountNew = jsonObj.amount * (-1)
            } else {
                amountNew = jsonObj.amount
            }

            await MongoClient.connect(process.env.DB_MONGO_URI, function (err, db) {
                if (err) throw err;
                var dbo = db.db(process.env.DB_MONGO_DATABASE_MOVEMENT);
                var myobj = { transactionId: jsonObj.transactionId, type: jsonObj.type, accountid: jsonObj.accountId, amount: amountNew, creationdate: jsonObj.creationDate };

                dbo.collection("movement").insertOne(myobj, async function (err, res) {
                    if (err) throw err;
                    console.log("1 document inserted");

                    await consumer.commitOffsets([{ topic, partition, offset: (Number(message.offset) + 1).toString() }])
                    console.log(`Commit message with accountId: ${jsonObj.accountId}`);

                    db.close();
                });
            });
        },
    })
}