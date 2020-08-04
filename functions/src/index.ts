import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as R from 'ramda';

admin.initializeApp()
const db = admin.firestore()

const app = express();
const main = express();

main.use('/api/v1', app);
main.use(bodyParser.json());

export const webApi = functions.https.onRequest(main);

interface Jar {
  id: string
  balance?: number
  url?: string
  transfers?: string
}

app.get('/wallets/:wallet/jars', async (req, res) => {
  const walletId = req.params.wallet;
  if (!walletId) res.status(400).send('Bad request')

  const jars: Jar[] = [];

  const jarQuerySnapshot = await db.collection('wallets')
    .doc(walletId)
    .collection('jar')
    .get()

  jarQuerySnapshot.forEach(
    doc => {
      jars.push({ 
        id: doc.id,
        url: `https://wallet-api.thehardway.pl/api/v1/wallets/${walletId}/jars/${doc.id}`
      })
    }
  )

  res.json(jars)
});

app.get('/wallets/:wallet/jars/:jar', async (req, res) => {
  const walletId = req.params.wallet;
  const jarId = req.params.jar;

  if (!walletId) res.status(400).send('Bad request')
  if (!jarId) res.status(400).send('Bad request')

  const jar = await db.collection('wallets')
    .doc(walletId)
    .collection('jar')
    .doc(jarId)
    .get()

  res.json({
    id: jar.id,
    balance: jar.data().balance,
    transfers: `https://wallet-api.thehardway.pl/api/v1/wallets/${walletId}/jars/${jar.id}/transfers`
  })
});

app.get('/wallets/:wallet/jars/:jar/transfers', async (req, res) => {
  const walletId = req.params.wallet;
  const jarId = req.params.jar;

  if (!walletId) res.status(400).send('Bad request')
  if (!jarId) res.status(400).send('Bad request')

  const transfers = []

  const transfersSnapchot = await db.collection('wallets')
    .doc(walletId)
    .collection('jar')
    .doc(jarId)
    .collection('transfers')
    .get()

  transfersSnapchot.forEach(
    doc => {
      transfers.push({
        id: doc.id,
        amount: doc.data().amount
      })
    }
  )

  res.json(transfers)
});

app.post('/wallets/:wallet/jars/:jar/transfers', async (req, res) => {
  const walletId = req.params.wallet;
  const jarId = req.params.jar;

  const amount = req.body.amount ? parseInt(`${req.body.amount}`, 10) : null

  if (!walletId) res.status(400).send('Bad request')
  if (!jarId) res.status(400).send('Bad request')
  if (!amount) res.status(400).send('Bad request');

  const transferRef = await db.collection('wallets').doc(`${walletId}`).collection('jar').doc(`${jarId}`).collection('transfers').add({ amount });
  const transfer = await transferRef.get();

  res.json({
    id: transfer.id,
    amount: transfer.data().amount
  })


});

export const updateBalance = functions
//  .region('europe-west1')
  .firestore
  .document('/wallets/{walletId}/jar/{jarName}/transfers/{transfer}')
  .onCreate(async (change, context) => {
    const walletId = context.params.walletId
    const jarName = context.params.jarName

    type Transfer = {
      amount: number
    }

    const response = await db.collection('wallets').doc(`${walletId}`).collection('jar').doc(`${jarName}`).collection('transfers').get()
    const transferList: Transfer[] = R.map(d => { return { amount: d.get('amount') }}, response.docs)

    const balanceJar =  R.pipe(
      R.map(R.path(['amount'])),
      R.sum,
    )(transferList)

    await db.collection('wallets').doc(`${walletId}`).collection('jar').doc(`${jarName}`).set({ balance: balanceJar }, { merge: true })
  })
