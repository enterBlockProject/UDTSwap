## Test

## Prerequisite
- local testnet node rpc endpoint
- 1 account for deploying UDTswap scripts
  - should have at least 4 cells and each cells having at least 100000 ckb.
- 2 accounts for minting test UDT
- 1 account for testing (all accounts should have enough ckb)

## How to test

### Compile
1. ```sudo docker run --rm -it -v `pwd`:/code nervos/ckb-riscv-gnu-toolchain:xenial bash```
2. `cd /code/UDTswap_scripts`
3. `chmod +x compile.sh`
4. `./compile.sh`
- Execute 3. only once

### Deploy
1. `npm install`
2. Change `sk`,`UDT1Owner`, `UDT2Owner`, `skTesting` to deploying account's secret key in `/test/consts.js`
3. Change `nodeUrl` to local testnet node rpc endpoint in `/test/consts.js`
4. `node ./test/deploy/exec 0` in root directory
5. `./hash.sh` in root directory
6. Compile scripts
7. `node ./test/deploy/exec 1` in root directory

### Test
`npm test` in root directory

- `deploy`
  - `deploy.js` 
    - script for deploying UDTswap script.
  - `exec.js`
    - script for executing deploy.
- `tx`
  - `txBuilder.js` 
    - script for making UDTswap's transactions.
  - `cellBuilder.js`
    - script for making UDTswap's transaction cells.
- `consts.js`
  - constants for UDTswap scripts.
- `utils.js`
  - script for utility functions.
  
- Codes above are just for test, not for production. You may use making UDTswap transactions similar to above or any other way.
Especially for getting live cells and signing and exposing secret keys and CKB node RPC endpoint, do not use above in production. 