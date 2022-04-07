import { BIP32Interface, fromSeed, fromBase58 } from "bip32";
import { payments, Psbt, bip32, networks } from "bitcoinjs-lib";
import { generateMnemonic, mnemonicToSeed } from "bip39";
import coinselect from "coinselect";

import { Address, DecoratedUtxo } from "src/types";

export const getNewMnemonic = (): string => {
  const mnemonic = generateMnemonic(256);
  console.log('output: ', mnemonic);
  return mnemonic;
};

export const getMasterPrivateKey = async (
  mnemonic: string
): Promise<BIP32Interface> => {
  const seed = await mnemonicToSeed(mnemonic); 
  const privateKey = fromSeed(seed, networks.testnet); 

  console.log(privateKey.toBase58()); 
  // xprv9s21ZrQH143K3fyh9nwMnoCjCnqpcrqkNWcy3NUDAyi32qmQBZJ2Zw856N7ruBr4dbCwqHYjozuryVKHQfox4XzVescETg6Uqwa1dCxExWx 

  return privateKey;;
};

export const getXpubFromPrivateKey = (
  privateKey: BIP32Interface,
  derivationPath: string
): string => {
  const child = privateKey.derivePath(derivationPath).neutered(); 
  const xpub = child.toBase58(); 

  console.log(xpub); 
  // xpub6Cw6ywDV5U4MxYUGQzEqjacRKBog2EBtaMPbYuE4iSsqPoTmKg7JZojNh74E52iVFYDVEJ2qN3AAvmyg1zZn3kKykbKrCydkBMxL5bLr5pp
  return xpub;
};

export const deriveChildPublicKey = (
  xpub: string,
  derivationPath: string
): BIP32Interface => {
  const node = bip32.fromBase58(xpub, networks.testnet); 
  const child = node.derivePath(derivationPath); 
  return child;
};

export const getAddressFromChildPubkey = (
  child: BIP32Interface
): payments.Payment => {
  const address = payments.p2wpkh({ 
    pubkey: child.publicKey, 
    network: networks.testnet, 
    }); 
    
  return address;
};

export const createTransaction = async (
  utxos: DecoratedUtxo[],
  recipientAddress: string,
  amountInSatoshis: number,
  changeAddress: Address
): Promise<Psbt> => {
    //const feeRate = await getFeeRates();

    const { inputs, outputs, fee } = coinselect(
      utxos,
      [
        {
          address: recipientAddress,
          value: amountInSatoshis,
        },
      ],
      1
    );
  
    if (!inputs || !outputs) throw new Error("Unable to construct transaction");
    if (fee > amountInSatoshis) throw new Error("Fee is too high!");
  
    const psbt = new Psbt({ network: networks.testnet });
    psbt.setVersion(2); // These are defaults. This line is not needed.
    psbt.setLocktime(0); // These are defaults. This line is not needed.
  
    inputs.forEach((input) => {
      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        sequence: 0xfffffffd, // enables RBF
        witnessUtxo: {
          value: input.value,
          script: input.address.output!,
        },
        bip32Derivation: input.bip32Derivation,
      });
    });
  
    outputs.forEach((output) => {
      // coinselect doesnt apply address to change output, so add it here
      if (!output.address) {
        output.address = changeAddress.address!;
      }
  
      psbt.addOutput({
        address: output.address,
        value: output.value,
      });
    });
  
    return psbt;
};

export const signTransaction = async (
  psbt: any,
  mnemonic: string
): Promise<Psbt> => {
  const seed = await mnemonicToSeed(mnemonic);
  const root = bip32.fromSeed(seed, networks.testnet);

  psbt.signAllInputsHD(root);
  psbt.validateSignaturesOfAllInputs();
  psbt.finalizeAllInputs();
  return psbt;
};
