var consts = require('./consts.js');

const utils = {
  writeConsts: function (idx, data) {
    let obj = consts.fs.readFileSync(
        __dirname + '/../consts.json',
        'utf8'
    );
    obj = JSON.parse(obj);
    if(idx===0) {
      obj.inputs.push(data);
    } else if(idx===1) {
      obj.scripts.push(data);
    } else if(idx===2) {
      obj.deps.push(data);
    } else if(idx===3) {
      let obj_hash = consts.fs.readFileSync(
          __dirname + '/../hash.txt',
          'utf8'
      );
      consts.fs.writeFileSync(
          __dirname + '/../hash.txt',
          obj_hash+data.toString()+'\n'
      );
    }
    let json = JSON.stringify(obj);
    consts.fs.writeFileSync(
        __dirname + '/../consts.json',
        json
    );
  },

  sleep: function(t){
    return new Promise(resolve=>setTimeout(resolve,t));
  },

  /**
   * @dev get same cell deps count with out point
   *
   * @param cellDeps cell deps
   * @param outPoint out point
   **/
  sameCellDeps : function (cellDeps, outPoint) {
    return cellDeps.filter((cellDep) =>
        cellDep.outPoint.txHash === outPoint.txHash
        && cellDep.outPoint.index === outPoint.index
    ).length;
  },

  toUDTData : function (bn) {
    return utils.changeEndianness(
        utils.bnToHex(bn)
    ).padEnd(34, '0');
  },

  changeEndianness : function (str) {
    const result = ['0x'];
    let len = str.length - 2;
    while (len >= 2) {
      result.push(str.substr(len, 2));
      len -= 2;
    }
    return result.join('');
  },

  bnToHex : function (bn) {
    let base = 16;
    let hex = BigInt(bn).toString(base);
    if (hex.length % 2) {
      hex = '0' + hex;
    }
    return "0x" + hex;
  },

  bnToHexNoLeadingZero : function(bn) {
    let base = 16;
    let hex = BigInt(bn).toString(base);
    return "0x" + hex;
  },

  /**
   * @dev get output amount from input amount, UDTswap pair's pool
   *
   * @param pool UDTswap pair's pool info
   * @param inputAmount input amount
   * @param rev input UDT is first UDT or not
   * @return output amount to receive
   **/
  SwapOutput(pool, inputAmount, rev) {
    return utils.calculateSwapOutputFromInput(
        rev ? pool.udt2ActualReserve : pool.udt1ActualReserve,
        rev ? pool.udt1ActualReserve : pool.udt2ActualReserve,
        inputAmount
    );
  },

  /**
   * @dev calculate output amount from input amount, reserves
   *
   * @param inputReserve input UDT's pool reserve
   * @param outputReserve output UDT's pool reserve
   * @param inputAmount input UDT amount
   * @return output amount to receive
   **/
  calculateSwapOutputFromInput(inputReserve, outputReserve, inputAmount) {
    const inputAmountWithFee = inputAmount * BigInt(997);
    const numerator = inputAmountWithFee * outputReserve;
    const denominator = inputReserve * BigInt(1000) + inputAmountWithFee;
    return numerator / denominator;
  },

  /**
   * @dev calculate second UDT amount to add,
   * liquidity token amount to receive from first UDT amount, UDTswap pair's pool
   *
   * @param pool UDTswap pair's pool info
   * @param udt1Amount first UDT amount to add
   * @return second UDT amount to add, liquidity token amount user will receive
   **/
  calculateAddLiquidityUDT2Amount(pool, udt1Amount) {
    let udt1Reserve = pool.udt1ActualReserve;
    let udt2Reserve = pool.udt2ActualReserve;
    const totalLiquidity = pool.totalLiquidity;

    const udt2Amount = udt2Reserve * udt1Amount / udt1Reserve + BigInt(1);
    const userLiquidity = totalLiquidity * udt1Amount / udt1Reserve;
    return {
      udt2Amount,
      userLiquidity
    }
  },

  /**
   * @dev calculate first, second UDT amount to receive from liquidity token amount
   * to burn UDTswap pair's pool
   *
   * @param pool UDTswap pair's pool info
   * @param userLiquidity liquidity token amount to burn
   * @return first, second UDT amount to receive
   **/
  calculateRemoveLiquidityAmount(pool, userLiquidity) {
    const udt1Reserve = pool.udt1ActualReserve;
    const udt2Reserve = pool.udt2ActualReserve;
    const totalLiquidity = pool.totalLiquidity;

    const udt1Amount = userLiquidity * udt1Reserve / totalLiquidity;
    const udt2Amount = userLiquidity * udt2Reserve / totalLiquidity;
    return {
      udt1Amount,
      udt2Amount
    }
  },
};

module.exports = utils;
