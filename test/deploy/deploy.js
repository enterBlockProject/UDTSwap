var consts = require('../consts.js');
var utils = require('../utils.js');

const deploy = {
    init: function() {
        consts.ckb = new consts.CKB(consts.nodeUrl);
        consts.pk = consts.ckb.utils.privateKeyToPublicKey(consts.sk);
        consts.pkh = `0x${consts.ckb.utils.blake160(
            consts.pk, 
            'hex'
        )}`;
        consts.addr = consts.ckb.utils.privateKeyToAddress(
            consts.sk,
            {
                prefix: 'ckt'
            });
        consts.lockScript = {
            hashType: 'type',
            codeHash: consts.nervosDefaultLockCodeHash,
            args: consts.pkh,
        };
        consts.lockHash = consts.ckb.utils.scriptToHash(consts.lockScript);
    },

    /**
     * @dev get cells to make type id scripts
     **/
    prepare: async function() {
        await deploy.init();
        await deploy.getAllCodeHashes(0);
    },

    /**
     * @dev deploy scripts and mint two test UDT to testing account
     **/
    deploy: async function () {
        let scripts = [
            "UDTswap_udt_based",
            "UDTswap_lock_udt_based",
            "UDTswap_liquidity_UDT_udt_based",
            "test_udt"
        ];
        let owners = [];
        owners.push(consts.UDT1Owner);
        owners.push(consts.UDT2Owner);
        let i = 0;
        await deploy.init();
        //deploy UDTswap scripts
        while(i<4) {
            let deployedTx = await deploy.deployUDTswap(scripts[i]);
            while(true) {
                let confirmed = await consts.ckb.rpc.getLiveCell({
                    txHash: deployedTx.txHash,
                    index: "0x0"
                }, false);
                if(confirmed.status === 'live') break;
                await utils.sleep(1000);
            }
            utils.writeConsts(1, deployedTx.type);
            utils.writeConsts(2, deployedTx.txHash);
            i+=1;
        }
        //mint two test UDTs to testing account
        i = 0;
        while(i<2) {
            let mintedTx = await deploy.mintUDT(owners[i]);
            while(true) {
                let confirmed = await consts.ckb.rpc.getLiveCell({
                    txHash: mintedTx.txHash,
                    index: "0x0"
                }, false);
                if(confirmed.status === 'live') break;
                await utils.sleep(1000);
            }
            i+=1;
        }
    },

    /**
     * @dev get type id args from out point
     *
     * @param outPoint out point
     * @return args of type id with out point
     **/
    getTypeIdArgs : function (outPoint) {
        let typeIdHash = consts.ckb.utils.blake2b(
            32,
            null,
            null,
            consts.ckb.utils.PERSONAL
        );

        let outpointStruct = new Map([
                ['txHash', outPoint.txHash],
                ['index', consts.ckb.utils.toHexInLittleEndian(outPoint.index)]
            ]);
        let serializedOutpoint = consts.ckb.utils.serializeStruct(outpointStruct);
        let serializedSince = consts.ckb.utils.toHexInLittleEndian("0x0", 8);
        let inputStruct = new Map([
                ['since', serializedSince],
                ['previousOutput', serializedOutpoint]
            ]);
        let inputSerialized = consts.ckb.utils.serializeStruct(inputStruct);

        typeIdHash.update(consts.ckb.utils.hexToBytes(inputSerialized));
        typeIdHash.update(consts.ckb.utils.hexToBytes("0x0000000000000000"));
        return `0x${typeIdHash.digest('hex')}`;
    },

    clear: function () {
        consts.fs.writeFileSync(__dirname + '/../../hash.txt', '');
        let obj = consts.fs.readFileSync(__dirname + '/../../consts.json', 'utf8');
        obj = JSON.parse(obj);
        obj.inputs = [];
        obj.scripts = [];
        obj.deps = [];
        let json = JSON.stringify(obj);
        consts.fs.writeFileSync(__dirname + '/../../consts.json', json);
    },

    /**
     * @dev prepare pure CKB cells and set type id script's code hash for UDTswap scripts
     *
     * @param startBlock block number to start searching cells
     **/
    getAllCodeHashes : async function (startBlock) {
        deploy.clear();

        let unspentCells = await consts.ckb.loadCells({
            start: BigInt(startBlock),
            lockHash: consts.lockHash
        });

        let totalCap = BigInt(0);

        unspentCells = unspentCells.filter((unspentCell) => {
            if(unspentCell.type == null) {
                totalCap += BigInt(unspentCell.capacity);
            }
            return unspentCell.type == null;
        });

        if(totalCap < BigInt(40000000000000)) {
            console.log("Not enough ckb");
            return;
        }

        if(unspentCells.length < 4) {
            let deployedTx = await deploy.makeCells(startBlock);
            if(deployedTx.txHash==null) {
                console.log("Not enough ckb");
                return;
            }

            while(true) {
                let confirmed = await consts.ckb.rpc.getLiveCell({
                    txHash: deployedTx.txHash,
                    index: "0x0"
                }, false);
                if(confirmed.status === 'live') break;
                await utils.sleep(1000);
            }

            unspentCells = await consts.ckb.loadCells({
                start: BigInt(startBlock),
                lockHash: consts.lockHash
            });

            unspentCells = unspentCells.filter((unspentCell) => {
                return unspentCell.type == null;
            });
        }

        let i = 0;
        while(i<4) {
            let scriptArgs = deploy.getTypeIdArgs(unspentCells[i].outPoint);
            let codeHash = consts.ckb.utils.scriptToHash({
                hashType: 'type',
                codeHash: '0x00000000000000000000000000000000000000000000000000545950455f4944',
                args: scriptArgs,
            });
            let codeHashToBytes = consts.ckb.utils.hexToBytes(codeHash);
            utils.writeConsts(0, unspentCells[i].outPoint);
            utils.writeConsts(3, codeHashToBytes);
            i+=1;
        }
    },

    /**
     * @dev send transaction of making four 100000 CKB cells to deploy UDTswap scripts with type id.
     *
     * @param startBlock block number to start searching cells
     * @return transaction hash of making 4 pure CKB cells
     **/
    makeCells: async function(startBlock) {
        const secp256k1Dep = await consts.ckb.loadSecp256k1Dep();
        let unspentCells = await consts.ckb.loadCells({
            start: BigInt(startBlock),
            lockHash: consts.lockHash
        });

        let totalCap = BigInt(0);
        unspentCells = unspentCells.filter((unspentCell) => {
            if(unspentCell.type == null) {
                totalCap += BigInt(unspentCell.capacity);
            }
            return unspentCell.type == null;
        });

        if(totalCap < BigInt(40006100005000)) {
            return {
                txHash: null,
                type: null
            }
        }

        const rawTransaction = consts.ckb.generateRawTransaction({
            fromAddress: consts.addr,
            toAddress: consts.addr,
            capacity: totalCap - BigInt(6100005000),
            fee: BigInt(5000),
            safeMode: false,
            cells: unspentCells,
            deps: secp256k1Dep,
        });

        rawTransaction.witnesses[0] = {
            lock: '',
            inputType: '',
            outputType: ''
        };

        rawTransaction.outputs[1].capacity = utils.bnToHexNoLeadingZero(
            totalCap - BigInt(40000000005000)
        );
        rawTransaction.outputs[0].capacity = '0x9184e72a000';

        rawTransaction.outputs.unshift(rawTransaction.outputs[0]);
        rawTransaction.outputs.unshift(rawTransaction.outputs[0]);
        rawTransaction.outputs.unshift(rawTransaction.outputs[0]);

        rawTransaction.outputsData.push('0x');
        rawTransaction.outputsData.push('0x');
        rawTransaction.outputsData.push('0x');

        const signedTx = consts.ckb.signTransaction(consts.sk)(rawTransaction);
        const realTxHash = await consts.ckb.rpc.sendTransaction(
            signedTx,
            "passthrough"
        );
        return {
            txHash: realTxHash,
            type: null
        };
    },

    /**
     * @dev deploy UDTswap scripts with type id
     *
     * @param idx index of UDTswap script
     * @param scriptHexData hex data of UDTswap script
     * @param startBlock block number to start searching live cells
     * @param capacity CKB capacity need to be deployed for UDTswap script
     * @param fee CKB fee amount need to be paid for UDTswap script
     * @return transaction hash of deploying UDTswap script, type script of deployed UDTswap script
     **/
    deployTypeIdScript: async function(idx, scriptHexData, startBlock, capacity, fee) {
        const secp256k1Dep = await consts.ckb.loadSecp256k1Dep();
        let unspentCells = await consts.ckb.loadCells({
            start: BigInt(startBlock),
            lockHash: consts.lockHash
        });

        let obj = consts.fs.readFileSync(__dirname + '/../../consts.json', 'utf8');
        obj = JSON.parse(obj);

        //filtering with type id script's cell
        unspentCells = unspentCells.filter((unspentCell) => {
            let i = 0;
            while(i<4) {
                if(idx===i) {
                    i+=1;
                    continue;
                }
                if(
                    unspentCell.outPoint.txHash === obj.inputs[i].txHash
                    && unspentCell.outPoint.index === obj.inputs[i].index
                ) return false;
                i+=1;
            }
            return unspentCell.type == null;
        });

        const rawTransaction = consts.ckb.generateRawTransaction({
            fromAddress: consts.addr,
            toAddress: consts.addr,
            capacity: BigInt(capacity),
            fee: BigInt(fee),
            safeMode: false,
            cells: unspentCells,
            deps: secp256k1Dep,
        });

        rawTransaction.witnesses[0] = {
            lock: '',
            inputType: '',
            outputType: ''
        };

        let scriptArgs = deploy.getTypeIdArgs(rawTransaction.inputs[0].previousOutput);

        rawTransaction.outputs[0].type = {
            hashType: 'type',
            codeHash: '0x00000000000000000000000000000000000000000000000000545950455f4944',
            args: scriptArgs,
        };

        rawTransaction.outputsData[0] = scriptHexData;

        const signedTx = consts.ckb.signTransaction(consts.sk)(rawTransaction);
        const realTxHash = await consts.ckb.rpc.sendTransaction(signedTx, "passthrough");
        return {
            txHash: realTxHash,
            type: rawTransaction.outputs[0].type
        };
    },

    /**
     * @dev deploy UDTswap scripts
     *
     * @param scriptName UDTswap script name to deploy
     * @return transaction hash of deploying UDTswap script, type script of deployed UDTswap script
     **/
    deployUDTswap: async function(scriptName) {
        let data = consts.fs.readFileSync(__dirname + "/../../UDTswap_scripts/"+scriptName);

        const scriptHexData = consts.ckb.utils.bytesToHex(data);
        let capacity = 7000000000000;
        let fee = 70000;
        let idx = 0;
        if(scriptName==="UDTswap_lock_udt_based") {
            capacity = 1200000000000;
            fee = 12000;
            idx = 1;
        } else if(
            scriptName==="UDTswap_liquidity_UDT_udt_based"
            || scriptName==="test_udt"
        ) {
            capacity = 4300000000000;
            fee = 43000;
            if(scriptName==="UDTswap_liquidity_UDT_udt_based") idx = 2;
            else idx = 3;
        }
        return await deploy.deployTypeIdScript(idx, scriptHexData, 0, capacity, fee);
    },

    /**
     * @dev mint test UDT to testing account
     *
     * @param sk secret key of UDT owner
     * @return transaction hash of minting test UDT
     **/
    mintUDT: async function(sk) {
        let pk = consts.ckb.utils.privateKeyToPublicKey(sk);
        let pkh = `0x${consts.ckb.utils.blake160(
            pk, 
            'hex'
        )}`;
        let addr = consts.ckb.utils.privateKeyToAddress(
            sk,
            {
                prefix: 'ckt'
            });
        let lockScript = {
            hashType: 'type',
            codeHash: consts.nervosDefaultLockCodeHash,
            args: pkh,
        };
        let lockHash = consts.ckb.utils.scriptToHash(lockScript);

        let toAddr = consts.ckb.utils.privateKeyToAddress(
            consts.skTesting,
            {
                prefix: 'ckt'
            });

        const secp256k1Dep = await consts.ckb.loadSecp256k1Dep();
        let unspentCells = await consts.ckb.loadCells({
            start: BigInt(0),
            lockHash: lockHash
        });

        unspentCells = unspentCells.filter((unspentCell) => {
            return unspentCell.type == null;
        });

        const rawTransaction = consts.ckb.generateRawTransaction({
            fromAddress: addr,
            toAddress: toAddr,
            capacity: BigInt(14300000000),
            fee: BigInt(1000),
            safeMode: false,
            cells: unspentCells,
            deps: secp256k1Dep,
        });

        rawTransaction.witnesses[0] = {
            lock: '',
            inputType: '',
            outputType: ''
        };

        let obj = consts.fs.readFileSync(__dirname + '/../../consts.json', 'utf8');
        obj = JSON.parse(obj);
        consts.testUDTType.args = obj.scripts[3].args;
        consts.testUDTDeps.outPoint.txHash = obj.deps[3];

        rawTransaction.cellDeps.push(consts.testUDTDeps);

        const testUDTScript = consts.testUDTType;
        const testUDTCodeHash = consts.ckb.utils.scriptToHash(testUDTScript);

        rawTransaction.outputs[0].type = {
            codeHash: testUDTCodeHash,
            hashType: "type",
            args: lockHash,
        };
        rawTransaction.outputsData[0] = utils.toUDTData(BigInt("10000000000000000000000000000"));


        const signedTx = consts.ckb.signTransaction(sk)(rawTransaction);
        const realTxHash = await consts.ckb.rpc.sendTransaction(
            signedTx,
            "passthrough"
        );
        return {
            txHash: realTxHash
        }
    },
};


module.exports = deploy;

