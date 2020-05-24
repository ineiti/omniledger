import { BehaviorSubject } from "rxjs";

import { ByzCoinRPC, IStorage } from "@dedis/cothority/byzcoin";
import { SpawnerInstance } from "@dedis/cothority/byzcoin/contracts";
import { Darc, IdentityDarc, SignerEd25519 } from "@dedis/cothority/darc";
import { Scalar } from "@dedis/kyber";

import { LongTermSecret } from "@dedis/cothority/calypso";
import { AddressBook } from "./addressBook";
import { CoinBS } from "./byzcoin/coinBS";
import { DarcBS } from "./byzcoin/darcsBS";
import { Calypso } from "./calypso";
import { CredentialSignerBS } from "./credentialSignerBS";
import { CredentialStructBS } from "./credentialStructBS";
import { CredentialTransaction } from "./credentialTransaction";
import { ICoin } from "./genesis";
import { KeyPair } from "./keypair";

/**
 * The User-class has references to all other needed classes.
 * Its only additional data is the private key, which is not available in any other class.
 * To allow for multiple users in the same db, `dbBase` is prefixed to all keys used by the user.
 *
 * To instantiate a user class, you should use one of the Builder.retrieveUser* methods.
 *
 * The user class and all classes it references are built on a simple premise:
 * the only necessary data is the credential-ID and the private key.
 * All other data is fetched live from the chain.
 * A caching system makes sure that this loading is fast after a first warming up of the cache.
 * Interacting with ByzCoin is optimized to only fetch changes of the instances.
 */
export class User {
    static readonly keyPriv = "private";
    static readonly keyCredID = "credID";
    static readonly keyMigrate = "storage/data.json";
    static readonly versionMigrate = 1;
    static readonly urlNewDevice = "/register/device";
    calypso?: Calypso;

    constructor(
        public bc: ByzCoinRPC,
        public db: IStorage,
        public kpp: KeyPair,
        public dbBase: string,
        public credStructBS: CredentialStructBS,
        public spawnerInstanceBS: BehaviorSubject<SpawnerInstance>,
        public coinBS: CoinBS,
        public credSignerBS: CredentialSignerBS,
        public addressBook: AddressBook) {

        const ltsID = credStructBS.credConfig.ltsID.getValue();
        const ltsX = credStructBS.credConfig.ltsX.getValue();
        if (ltsID && ltsID.length === 32 && ltsX) {
            const lts = new LongTermSecret(this.bc, ltsID, ltsX);
            this.calypso = new Calypso(lts, credSignerBS.getValue().getBaseID(), credStructBS.credCalypso);
        }
    }

    get kiSigner(): SignerEd25519 {
        return this.kpp.signer();
    }

    get identityDarcSigner(): IdentityDarc {
        return new IdentityDarc({id: this.credSignerBS.getValue().getBaseID()});
    }

    async switchKey(previous: KeyPair): Promise<KeyPair> {
        const newKP = KeyPair.rand();
        let dbs: DarcBS;
        for (const db of this.credSignerBS.devices.getValue()) {
            const rules = await db.getValue().ruleMatch(Darc.ruleSign, [previous.signer()], () => undefined);
            if (rules.length > 0) {
                dbs = db;
            }
        }

        if (!dbs) {
            throw new Error("didn't find darc with that signer");
        }
        await this.executeTransactions((tx) => {
            dbs.setSignEvolve(tx, newKP.signer());
        }, 10);
        this.kpp = newKP;
        await this.save();
        return newKP;
    }

    // TODO: should this be here or in CredentialStructBS?
    getUrlForDevice(priv: Scalar): string {
        return `${User.urlNewDevice}?` +
            `credentialIID=${this.credStructBS.id.toString("hex")}` +
            `&ephemeral=${priv.marshalBinary().toString("hex")}`;
    }

    async save(base = this.dbBase, priv = this.kpp.priv.marshalBinary(),
               credID = this.credStructBS.id): Promise<void> {
        await this.db.set(`${base}:${User.keyPriv}`, priv);
        await this.db.set(`${base}:${User.keyCredID}`, credID);
    }

    async clearDB(base = this.dbBase) {
        return this.save(base, Buffer.alloc(0), Buffer.alloc(0));
    }

    iCoin(): ICoin {
        return {
            instance: this.coinBS.getValue(),
            signers: [this.kpp.signer()],
        };
    }

    startTransaction(): CredentialTransaction {
        return new CredentialTransaction(this.bc, this.spawnerInstanceBS.getValue(), this.iCoin());
    }

    async executeTransactions(addTxs: (tx: CredentialTransaction) => Promise<unknown> | unknown,
                              wait = 0): Promise<void> {
        const tx = new CredentialTransaction(this.bc, this.spawnerInstanceBS.getValue(), this.iCoin());
        await addTxs(tx);
        await tx.sendCoins(wait);
    }
}
