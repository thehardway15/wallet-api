import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as R from 'ramda';

admin.initializeApp()
const db = admin.firestore()

export const wallet = functions
  .region('europe-west1')
  .https
  .onRequest(async (req, res) => {
    const wallet_id = req.query.wallet;
    if (!wallet_id) res.status(400).send('Bad request');
    const jars = await  db.collection('wallets').doc(`${wallet_id}`).collection('jar').get()
    res.json(jars.docs.map(doc => doc.id));
  });

export const payin = functions
  .region('europe-west1')
  .https
  .onRequest(async (req, res) => {
    const wallet_id = req.query.wallet;
    const jar_name = req.query.jar;
    const amount = req.query.amount ? parseInt(`${req.query.amount}`, 10) : null
    if (!wallet_id) res.status(400).send('Bad request');
    if (!jar_name) res.status(400).send('Bad request');
    if (!amount) res.status(400).send('Bad request');

    await db.collection('wallets').doc(`${wallet_id}`).collection('jar').doc(`${jar_name}`).collection('transfers').add({ amount });
    res.status(201).send('OK')
  });

export const transfers = functions
  .region('europe-west1')
  .https
  .onRequest(async (req, res) => {
    const wallet_id = req.query.wallet;
    const jar_name = req.query.jar;
    if (!wallet_id) res.status(400).send('Bad request');
    if (!jar_name) res.status(400).send('Bad request');

    const transferList = await db.collection('wallets').doc(`${wallet_id}`).collection('jar').doc(`${jar_name}`).collection('transfers').get();
    res.json(transferList.docs.map(transfer => transfer.data()));
  })

export const updateBalance = functions
  .region('europe-west1')
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

export const balance = functions
  .region('europe-west1')
  .https
  .onRequest(async (req, res) => {
    const wallet_id = req.query.wallet;
    const jar_name = req.query.jar;
    if (!wallet_id) res.status(400).send('Bad request');
    if (!jar_name) res.status(400).send('Bad request');

    const response = await db.collection('wallets').doc(`${wallet_id}`).collection('jar').doc(`${jar_name}`).get()
    const jar = response.data()
    res.json({ balanceJar: jar.balance || 0 })
  })
