
#Nervos Network Grants Program

# UDTswap cell structure
The indicated cells in the figure above should have the same index as the figure. However, in the case of multiple swaps, the index of the fee cell may change.

The first UDT or the second UDT can be ckb and the method is the same.

The output cells, which will serve as the change for all transactions, can be located at any position as long as the above picture and the following conditions are satisfied.

If two UDTs are specified, there is only one pair. The order is divided from smallest to largest UDT type script hash.

There are 4 types of transactions.



- Create UDTswap

Create cells to store the liquidity pool related data.

 

- Add liquidity pool

By adding a liquidity pool, the user provides the first UDT and the second UDT pair.

Liquidity pool providers are provided with a numerical ratio of the liquidity pool according to the first UDT ratio of the liquidity pool.

 

- Liquidity Pool Removal

Depending on the ratio of the digitized liquidity pool provided to the user, it can be removed from the liquidity pool again and the first UDT and the second UDT can be returned according to the removed ratio of the liquidity pool.

 

- Swap UDT to UDT

Depending on the ratio of the first UDT to the second UDT provided in the liquidity pool, you can either provide the first UDT and receive the second UDT, or provide the second UDT to receive the first UDT.


The part represented by the shared state in the figure means that the latest updated output should be used as input as information related to the liquidity pool shared by all users.

Also, if the liquidity pool is empty, there will be 300 ckb for ckb, and the remaining ckb is the liquidity pool balance.

Likewise, if the liquidity pool is empty, the UDT will have 1, and the rest of the UDTs will be the liquidity pool balance.

There is a 61 ckb fee for all transactions except creation, which is a fixed fee to prevent occupancy of the shared state.

When swapping, the fee is 0.3%, which is left in the liquidity pool and can be earned by liquidity pool providers at a rate.


## Create UDTswap
![creating pool](/cell%20structure/cell%20structure/create%20pool%20cell.png)

There are at least 1 input and 3 outputs.

The input is as follows.
- ckb for cell generation

The output is shown below.
- Cell to store the numerical value of the ratio of the first UDT liquidity pool provision amount to the second UDT liquidity pool provision amount in data
- Cell where the first UDT will be locked up and stored
- Cell where the second UDT is locked up and stored

When creating UDTswap type script, the first input of the transaction is identified as a unique pool using args.

The UDT of an empty pool is 1, or 300ckb for ckb.

The ckb and UDT input cells for pool creation can be located anywhere if the above picture is satisfied.


## Add liquidity pool
![adding liquidity](/cell%20structure/cell%20structure/UDTswap%20add%20liquidity%20cell.png)

There are at least 3 inputs and 5 outputs.

The inputs are:
- Cell that stores liquidity pool information
- Cell locking the first UDT as much as the liquidity pool information
- Cell locking up the second UDT as much as the liquidity pool information

The outputs are:
- Cell with updated liquidity pool information
- Cell to lock up the first UDT as much as the updated liquidity pool information
- Cell to lock up the second UDT as much as the updated liquidity pool information
- Fixed fee cell to prevent occupancy of shared state
- Cell to store user's liquidity ratio information

When adding liquidity, you must add it according to the ratio of the first UDT and the second UDT of the liquidity pool.

UDT input cells required to add liquidity can be located anywhere if the above picture is satisfied.

There is no need to have one cell to store the user's liquidity ratio information after adding liquidity, and it does not matter if there is at least one cell in the fifth output.

The first UDT reserve means the first UDT amount in the liquidity pool.

The second UDT reserve means the second UDT amount in the liquidity pool.

Total liquidity means the total ratio of the liquidity pool.

![liquidity calculation](/cell%20structure/cell%20structure/liquidity%20calculation.png)

For the second UDT to be added,
- Second UDT reserve * First UDT amount to add liquidity / First UDT reserve + 1

The user's liquidity ratio information is as follows.
- total liquidity * first UDT amount to add liquidity / first UDT reserve

When the liquidity pool is empty, if you add liquidity for the first time, you can enter as many of the first UDT and the second UDT as the basis, and it is calculated based on the ratio when you add liquidity later. In addition, when liquidity is first added, total liquidity is equal to the first UDT amount.


## Liquidity Pool Removal
![removing liquidity](/cell%20structure/cell%20structure/UDTswap%20remove%20liquidity%20cell.png)

There are at least 4 inputs and 4 outputs.

The inputs are:
- Cell that stores liquidity pool information
- Cell that locks up the first UDT as much as the liquidity pool information
- Cell locking the second UDT as much as the liquidity pool information
- Cell that stores user's liquidity information

The outputs are:
- Cell with updated liquidity pool information
- Cell to lock up the first UDT as much as the updated liquidity pool information
- Cell to lock up the second UDT as much as the updated liquidity pool information
- Fixed fee cell to prevent occupancy of shared state

When liquidity is removed, it will be returned according to the ratio of the first UDT and the second UDT of the liquidity pool.

It does not need to be one cell that stores the user's liquidity information, and it does not matter if there is at least one cell in the fourth input.

UDT output cells to be returned after removing liquidity can be located at any position if the above conditions are satisfied.

![liquidity calculation](/cell%20structure/cell%20structure/liquidity%20calculation.png)

For the returned UDT, it is as follows, and both the first and second UDTs are the same.
- removing liquidity * UDT reserve / total liquidity


## Swap UDT to UDT
![UDT to UDT swap](/cell%20structure/cell%20structure/UDTswap%20UDT%20to%20UDT%20swap%20cell.png)

There are at least 3 inputs and 4 outputs.

The inputs are:
- Cell that stores liquidity pool information
- Cell that locks up the first UDT as much as the liquidity pool information
- Cell locking the second UDT as much as the liquidity pool information

The outputs are:
- Cell with updated liquidity pool information
- Cell to lock up the first UDT as much as the updated liquidity pool information
- Cell to lock up the second UDT as much as the updated liquidity pool information
- Fixed fee cell to prevent occupancy of shared state

Swapping the first UDT with the second UDT and swapping the second UDT with the first UDT work with the same formula.

The UDT cell that the user needs for swap can be input to any location that satisfies the picture above.

The UDT cell that the user will receive after swapping does not matter at any location that satisfies the picture above.

When multiple swaps due to multiple pools are performed in one transaction, the input and output must be present in sequence, in order of three, in order of the storage of the liquidity pool information, the cell that locks up the first UDT, and the cell that locks up the second UDT. The fee cell must exist as the output cell immediately after all the above cells. 

All UDT inputs and outputs required for this can be located at any position as long as the above conditions are satisfied.



The input amount means the amount of ckb or UDT to be provided by the user.

The output amount is the amount of ckb or UDT the user will receive.

The input reserve means the amount of liquidity pool provided by the user, which is the same as ckb or UDT.

The output reserve is the amount of liquidity pool that the user will receive equal to ckb or UDT.


![swap calculation](/cell%20structure/cell%20structure/swap%20calculation.png)

The formula is: 
1. When determining the input amount based on the output amount
- input amount = input reserve * output amount * 1000 / (output reserve-output amount) * 997 + 1

2. When determining the output amount based on the input amount
- output amount = input amount * 997 * output reserve / (input reserve * 1000 + input amount * 997)

# UDTswap scripts

## UDTswap_udt_based.c 
UDTswap type script

- args : Pool creating transaction's serialized first input
- hash type : 'type'

![type script main](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20main%20flow.png)
![type script default](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20default%20check%20flow.png)
![type script pool creation](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20pool%20creation%20check%20flow.png)
![type script fee](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20fee%20check%20flow.png)
![type script swap](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20swap%20check%20flow.png)
![type script add](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20add%20liquidity%20flow.png)
![type script remove](/UDTswap%20flow/captures/type/UDTswap%20type%20script%20remove%20liquidity%20flow.png)

## UDTswap_lock_udt_based.c
UDTswap lock script

- args : first UDT type script hash + second UDT type script hash
- hash type : 'type'

![lock script main](/UDTswap%20flow/captures/lock/UDTswap%20lock%20script%20main%20flow.png)

## UDTswap_liquidity_UDT_udt_based.c
UDTswap liquidity udt type script

- args : Pool's UDTswap lock script hash (owner mode) + UDTswap type script args (Pool creating transaction's serialized first input)
- hash type : 'type'

![liquidity UDT main](/UDTswap%20flow/captures/liquidity%20udt/UDTswap%20liquidity%20UDT%20type%20script%20main%20flow.png)
![liquidity UDT owner mode](/UDTswap%20flow/captures/liquidity%20udt/UDTswap%20liquidity%20UDT%20type%20script%20owner%20mode%20liquidity%20check%20flow.png)

## UDTswap_common.h
UDTswap constants header

# UDTswap feature
- Supports CKB and UDT based pools
- Supports multiple pools for same CKB and UDT pairs
- Supports multiple swaps for different pools
