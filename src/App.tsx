import { useEffect, useState } from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import { MenuIcon } from "@heroicons/react/outline";

import Sidebar from "src/components/Sidebar";

import Instructions from "src/pages/Instructions";
import Addresses from "src/pages/Addresses";
import Send from "src/pages/Send";
import Receive from "src/pages/Receive";
import Transactions from "src/pages/Transactions";
import Utxos from "src/pages/UTXOs";
import Settings from "src/pages/Settings";

import { Address, BlockstreamAPITransactionResponse, DecoratedTx, DecoratedUtxo } from "src/types";
import { 
getNewMnemonic, 
getMasterPrivateKey, 
getAddressFromChildPubkey, 
getXpubFromPrivateKey, 
deriveChildPublicKey } 
from "src/utils/bitcoinjs-lib";
import {
  serializeTxs,
} from "src/utils/index";
import {
  getTransactionsFromAddress,
  getUtxosFromAddress
} from "src/utils/blockstream-api";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mnemonic, setMnemonic] = useState(""); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [xpub, setXpub] = useState(""); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [masterFingerprint, setMasterFingerprint] = useState(new Buffer("")); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [addresses, setAddresses] = useState<Address[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [changeAddresses, setChangeAddresses] = useState<Address[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [transactions, setTransactions] = useState<DecoratedTx[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [utxos, setUtxos] = useState<DecoratedUtxo[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars

  // Mnemonic / Private Key / XPub
  useEffect(() => {
    const getSeed = async () => {
      try {
        let newMnemonic = "";
        if (process.env.REACT_APP_MNEMONIC) {
          newMnemonic = process.env.REACT_APP_MNEMONIC;
        } else {
          newMnemonic = getNewMnemonic();
        }
        setMnemonic(newMnemonic);
        const privateKey = await getMasterPrivateKey(newMnemonic);
        setMasterFingerprint(privateKey.fingerprint);
        const derivationPath = "m/84'/0'/0'"; // P2WPKH
        const currentXpub = getXpubFromPrivateKey(privateKey, derivationPath);
        setXpub(currentXpub);


        
      } catch (e) {
        console.log(e);
      }
    };
    getSeed();
  }, []);

  // Addresses
  useEffect(() => {
    try {
      
      const addresses: Address[] = [];
      for(let i = 0; i < 10; i++){
        const derivationPath = `0/${i}`;
        const child = deriveChildPublicKey(xpub, derivationPath);
        const address = getAddressFromChildPubkey(child);
        addresses.push({
          ...address,
          derivationPath,
          masterFingerprint
        });
      }

      setAddresses(addresses);

      const changeAddresses: Address[] = [];
      for(let i = 0; i < 10; i++){
        const derivationPath = `1/${i}`;
        const changeChild = deriveChildPublicKey(xpub, derivationPath);
        const changeAddress = getAddressFromChildPubkey(changeChild);
        changeAddresses.push({
          ...changeAddress,
          derivationPath,
          masterFingerprint
        });
      }

      setChangeAddresses(changeAddresses);

    } catch (e) {
      console.log(e);
    }
  }, [masterFingerprint, xpub]);

  // Transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const currentTransactionBatch: BlockstreamAPITransactionResponse[] = [];
        for (let i = 0; i < 10; i++) {
          const currentAddress = addresses[i];
          const addressTransactions = await getTransactionsFromAddress(
            currentAddress
          );
          currentTransactionBatch.push(...addressTransactions);
        }

        const serializedTxs = serializeTxs(
          currentTransactionBatch,
          addresses,
          changeAddresses
        );

        setTransactions(serializedTxs);
      } catch (e) {
        console.log(e);
      }
    };

    fetchTransactions();
  }, [addresses, changeAddresses]);

  // UTXOs
  useEffect(() => {
    const fetchUtxos = async () => {
      try {
        let parsedUtxos = []
        let allAddresses = [...addresses, ...changeAddresses];
        for(let address of allAddresses){
          let uTxos = await getUtxosFromAddress(address);
          for(let utxo of uTxos){
            parsedUtxos.push({
              ...utxo,
              address,
              bip32Derivation: [
                {
                  pubkey: address.pubkey!,
                  path: `m/84'/0'/0'/${address.derivationPath}`,
                  masterFingerprint: masterFingerprint,
                }
              ]

            })
          }
        }
        setUtxos(parsedUtxos);
      } catch (e) {
        console.log(e);
      }
    };

    fetchUtxos();
  }, [addresses, changeAddresses, masterFingerprint]);

  return (
    <Router>
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="md:pl-64 flex flex-col flex-1">
        <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-100">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <MenuIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <Switch>
          <Route exact path="/">
            <Instructions />
          </Route>
          <Route exact path="/addresses">
            <Addresses
              addresses={addresses}
              changeAddresses={changeAddresses}
            />
          </Route>
          <Route exact path="/send">
            <Send
              utxos={utxos}
              changeAddresses={changeAddresses}
              mnemonic={mnemonic}
            />
          </Route>
          <Route exact path="/receive">
            <Receive addresses={addresses} />
          </Route>
          <Route exact path="/transactions">
            <Transactions transactions={transactions} />
          </Route>
          <Route exact path="/utxos">
            <Utxos utxos={utxos} />
          </Route>
          <Route exact path="/settings">
            <Settings mnemonic={mnemonic} xpub={xpub} />
          </Route>
        </Switch>
      </div>
    </Router>
  );
}
