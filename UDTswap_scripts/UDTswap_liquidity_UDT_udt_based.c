#include <memory.h>
#include "protocol.h"
#include "ckb_syscalls.h"
#include "udtswap_common.h"

/*
 * @dev check UDTswap liquidity udt owner mode
 *
 * check args and input 0's lock hash (owner mode)
 * check all input sum and output sum with data field
 * check udtswap type code hash
 * check udtswap type args's tx input 0
 * check before liquidity and after liquidity
 * check mint, burn, transfer
 * check input sum , output sum same
 *
 * @param input_amount UDTswap liquidity udt input amount sum
 * @param output_amount UDTswap liquidity udt output amount sum
 */

int check_owner_mode_transfer(uint128_t input_amount, uint128_t output_amount) {
  uint8_t script_buf[UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE];
  uint8_t *owner_cell_code_hash_buf;
  uint8_t *owner_cell_args_buf;
  uint64_t len = UDTSWAP_TYPE_SCRIPT_SIZE;
  int ret = ckb_load_cell_by_field(script_buf, &len, 0, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_INPUT, CKB_CELL_FIELD_TYPE);
  if(ret!=CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX - ret;
  }
  if(len!=UDTSWAP_TYPE_SCRIPT_SIZE) {
    return UDTSWAP_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
  }
  owner_cell_code_hash_buf = &script_buf[CODE_HASH_START];
  owner_cell_args_buf = &script_buf[ARGS_START];

  if(memcmp(udtswap_type_script_code_hash_buf, owner_cell_code_hash_buf, CODE_HASH_SIZE)!=0) {
    return SCRIPT_NOT_MATCH_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
  }
  //udtswap type code hash checked

  uint8_t script_buf2[UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE];
  uint8_t *args_buf;
  len = UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE;
  ret = ckb_load_cell_by_field(script_buf2, &len, 0, 0, CKB_SOURCE_GROUP_INPUT, CKB_CELL_FIELD_TYPE);
  if(ret==INDEX_OUT_OF_BOUND_ERROR) {
    len = UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE;
    ret = ckb_load_cell_by_field(script_buf2, &len, 0, 0, CKB_SOURCE_GROUP_OUTPUT, CKB_CELL_FIELD_TYPE);
    if(ret!=CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX - ret;
    }
  } else if(ret!=CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX - ret;
  }
  if(len!=UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE) {
    return UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
  }
  args_buf = &script_buf2[UDTSWAP_LIQUIDITY_UDT_ARGS_TX_INPUT_START];

  if(memcmp(owner_cell_args_buf, args_buf, TX_INPUT_SIZE)!=0) {
    return TX_INPUT_NOT_MATCH_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
  }
  //udtswap type tx input and liquidity udt tx input same checked

  uint8_t buffer[UDTSWAP_DATA_SIZE];
  len = UDTSWAP_DATA_SIZE;
  ret = ckb_load_cell_data(buffer, &len, 0, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_INPUT);
  if (ret!=CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX - ret;
  }
  if(len!=UDTSWAP_DATA_SIZE) {
    return UDTSWAP_DATA_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
  }

  uint128_t total_liquidity_before = get_uint128_t(UDTSWAP_DATA_TOTAL_LIQUIDITY_START, buffer);

  len = UDTSWAP_DATA_SIZE;
  ret = ckb_load_cell_data(buffer, &len, 0, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_OUTPUT);
  if (ret!=CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX - ret;
  }
  if(len!=UDTSWAP_DATA_SIZE) {
    return UDTSWAP_DATA_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
  }

  uint128_t total_liquidity_after = get_uint128_t(UDTSWAP_DATA_TOTAL_LIQUIDITY_START, buffer);

  if (total_liquidity_after>total_liquidity_before) { //mint (add liquidity)
    return (input_amount + total_liquidity_after - total_liquidity_before == output_amount ? CKB_SUCCESS : UDTSWAP_LIQUIDITY_UDT_INPUT_OUTPUT_NOT_MATCH_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX);
  } else if(total_liquidity_after<total_liquidity_before) { //burn (remove liquidity)
    return (input_amount == output_amount + total_liquidity_before - total_liquidity_after ? CKB_SUCCESS : UDTSWAP_LIQUIDITY_UDT_INPUT_OUTPUT_NOT_MATCH_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX);
  } else {
    return (input_amount == output_amount ? CKB_SUCCESS : UDTSWAP_LIQUIDITY_UDT_INPUT_OUTPUT_NOT_MATCH_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX);
  }
  //with total liquidity, check mint, burn
}

/*
 * @dev check UDTswap liquidity udt script
 * check owner mode
 * check UDTswap liquidity udt input amount
 * check UDTswap liquidity udt output amount
 */

int main() {
  unsigned char script[SCRIPT_SIZE];
  uint64_t len = SCRIPT_SIZE;
  int ret = ckb_load_script(script, &len, 0);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX - ret;
  }
  if (len > SCRIPT_SIZE) {
    return UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
  }
  mol_seg_t script_seg;
  script_seg.ptr = (uint8_t *)script;
  script_seg.size = len;

  if (MolReader_Script_verify(&script_seg, false) != MOL_OK) {
    return ERROR_ENCODING;
  }

  mol_seg_t args_seg = MolReader_Script_get_args(&script_seg);
  mol_seg_t args_bytes_seg = MolReader_Bytes_raw_bytes(&args_seg);
  if (args_bytes_seg.size != SCRIPT_HASH_SIZE + TX_INPUT_SIZE) {
    return UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
  }

  int owner_mode = 0;
  uint8_t buffer[SCRIPT_HASH_SIZE];
  len = SCRIPT_HASH_SIZE;
  ret = ckb_load_cell_by_field(buffer, &len, 0, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_INPUT, CKB_CELL_FIELD_LOCK_HASH);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX - ret;
  }
  if (len != SCRIPT_HASH_SIZE) {
    return SCRIPT_HASH_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
  }
  if (memcmp(buffer, args_bytes_seg.ptr, SCRIPT_HASH_SIZE) == 0) {
    owner_mode = 1;
  }
  // owner mode checked (udtswap lock hash)

  uint128_t input_amount = 0;
  size_t i = 0;
  while (1) {
    uint128_t current_amount = 0;
    len = UDTSWAP_LIQUIDITY_UDT_DATA_SIZE;
    ret = ckb_load_cell_data((uint8_t *)&current_amount, &len, 0, i, CKB_SOURCE_GROUP_INPUT);
    if (ret == INDEX_OUT_OF_BOUND_ERROR) {
      break;
    }
    if (ret != CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX - ret;
    }
    if (len != UDTSWAP_LIQUIDITY_UDT_DATA_SIZE) {
      return UDTSWAP_LIQUIDITY_UDT_DATA_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
    }
    input_amount += current_amount;
    if (input_amount < current_amount) {
      return OVERFLOW_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
    }
    if (current_amount==0) { // no zero amount
      return UDTSWAP_LIQUIDITY_UDT_ZERO_AMOUNT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
    }
    i += 1;
  }
  //sum input amount

  uint128_t output_amount = 0;
  i = 0;
  while (1) {
    uint128_t current_amount = 0;
    len = UDTSWAP_LIQUIDITY_UDT_DATA_SIZE;
    ret = ckb_load_cell_data((uint8_t *)&current_amount, &len, 0, i, CKB_SOURCE_GROUP_OUTPUT);
    if (ret == INDEX_OUT_OF_BOUND_ERROR) {
      break;
    }
    if (ret != CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX - ret;
    }
    if (len != UDTSWAP_LIQUIDITY_UDT_DATA_SIZE) {
      return UDTSWAP_LIQUIDITY_UDT_DATA_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
    }
    output_amount += current_amount;
    if (output_amount < current_amount) {
      return OVERFLOW_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
    }
    if (current_amount==0) { //no zero output
      return UDTSWAP_LIQUIDITY_UDT_ZERO_AMOUNT_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
    }
    i += 1;
  }
  //sum output amount

  if (owner_mode) {
    return check_owner_mode_transfer(input_amount, output_amount);
  }
  //owner mode mint, burn checked

  if (input_amount != output_amount) {
    return UDTSWAP_LIQUIDITY_UDT_INPUT_OUTPUT_NOT_MATCH_ERROR - UDTSWAP_LIQUIDITY_UDT_ERROR_IDX;
  }
  //input amount = output amount
  return CKB_SUCCESS;
}