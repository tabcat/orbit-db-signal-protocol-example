
'use strict'
const signalStore = require('@tabcat/orbit-db-signal-protocol-store')
window.signalStore = signalStore
const util = require('@tabcat/orbit-db-signal-protocol-store/src/helpers')
window.util = util

import IpfsBundle from './ipfsBundle'
const orbitdb = require('orbit-db')

var libsignal = require('@tabcat/signal-protocol')
window.libsignal = libsignal
var KeyHelper = libsignal.KeyHelper
window.KeyHelper = KeyHelper


window.serializeKeyPair = (idKeys) => JSON.stringify({ pubKey:util.toString(idKeys.pubKey), privKey:util.toString(idKeys.privKey) })
window.deserializeIdentity = (serializedIdKeys) => Object.keys(JSON.parse(serializedIdKeys))
	.reduce((keyObj, key) => ({ ...keyObj, [key]:util.toArrayBuffer(JSON.parse(serializedIdKeys)[key]) }),{})

window.openStore = async (name) => {
	const type = 'docstore'
	const options = { replicate:false }
	try {
		const create = await orbit.create(name, type, options)
		await create.load()
		return create
	} catch(e) {
		const open = await orbit.open(
			await orbit.determineAddress(name, type, options), 
			{ localOnly:true }
		)
		await open.load()
		return open
	}
}

window.assignIdentity = async (store) => {
	const keyPair = await KeyHelper.generateIdentityKeyPair()
	await store.put('identityKey', serializeKeyPair(keyPair))
	await store.put('registrationId', await KeyHelper.generateRegistrationId())
}

window.genKeyBundle = async (store, preKeyId, signedPreKeyId) => {
	const identity = await store.getIdentityKeyPair()
	const registrationId = await store.getLocalRegistrationId()
	const preKey = await KeyHelper.generatePreKey(preKeyId)
  const signedPreKey = await KeyHelper.generateSignedPreKey(identity, signedPreKeyId)

	await store.storePreKey(preKeyId, preKey.keyPair)
	await store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair)

	return {
    identityKey: identity.pubKey,
    registrationId : registrationId,
    preKey:  {
        keyId     : preKeyId,
        publicKey : preKey.keyPair.pubKey
    },
    signedPreKey: {
        keyId     : signedPreKeyId,
        publicKey : signedPreKey.keyPair.pubKey,
        signature : signedPreKey.signature
    }
	}
}

window.test = async () => {
  window.aliceAddr = new libsignal.SignalProtocolAddress("xxxxxxxxx", 1)
  window.bobAddr = new libsignal.SignalProtocolAddress("yyyyyyyyyyyyy", 1)

	// reset the store from last session
  await (await window.openStore('alice')).drop()
  await (await window.openStore('bob')).drop()

  window.aliceStore = new signalStore(await window.openStore('alice'))	
  window.bobStore = new signalStore(await window.openStore('bob'))
	const handleWrite = (store) => {
		console.log(`${store.address.path} store:`)
		console.log(store.query(() => true))
	}
	aliceStore.store.events.on('write', () => handleWrite(aliceStore.store))
	bobStore.store.events.on('write', () => handleWrite(bobStore.store))


  window.bobPreKeyId = 1337
  window.bobSignedKeyId = 1

	console.log('assigning Identities')
  await assignIdentity(window.aliceStore)
  await assignIdentity(window.bobStore)

	console.log('bob generating bob\'s key bundle')
  window.bobKeyBundle = await genKeyBundle(window.bobStore, window.bobPreKeyId, window.bobSignedKeyId)

  window.builder = new libsignal.SessionBuilder(window.aliceStore, window.bobAddr)
	console.log('alice processing bob\'s key bundle')
  await builder.processPreKey(window.bobKeyBundle)

	console.log('creating sessionCiphers')
  window.aliceSessionCipher = new libsignal.SessionCipher(window.aliceStore,window.bobAddr);
  window.bobSessionCipher = new libsignal.SessionCipher(window.bobStore, window.aliceAddr);

  window.messageA = 'hi'
	console.log('alice encrypting message')
  window.cipherTexta = await aliceSessionCipher.encrypt(util.toArrayBuffer(messageA))
	console.log('bob decrypting preKey whisper message')
  window.clearTexta = await bobSessionCipher.decryptPreKeyWhisperMessage(cipherTexta.body, 'binary')

  window.messageB = 'hello'
	console.log('bob encrypting message')
  window.cipherTextb = await bobSessionCipher.encrypt(util.toArrayBuffer(messageB))
	console.log('alice decrypting message')
  window.clearTextb = await aliceSessionCipher.decryptWhisperMessage(cipherTextb.body, 'binary')

  if (messageA === util.toString(clearTexta) && messageB === util.toString(clearTextb)) {
		console.log('successfully read encrypted messages')
	}
}

const ipfs = IpfsBundle()
ipfs.on('ready', function(){
	window.ipfs = ipfs
	orbitdb.createInstance(ipfs).then(function(orbit) {
		window.orbit = orbit
	}).then(() => window.test())
})


