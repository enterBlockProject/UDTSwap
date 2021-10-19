#include <memory.h>
#include "protocol.h"
#include "ckb_syscalls.h"
#include "udtswap_common.h"

typedef unsigned __int128 uint128_t;

#define ERROR_IDX 50

int main() {
  ////////////////////////////////////////////////////////////////////////////////////////////////

  ////////////////////////////////////////////////////////////////////////////////////////////////

  unsigned char script[SCRIPT_SIZE];
  uint64_t len = SCRIPT_SIZE;
  int ret = ckb_load_script(script, &len, 0);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR + ERROR_IDX - ret;
  }
  if (len > SCRIPT_SIZE) {
    return UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR + ERROR_IDX;
  }
  mol_seg_t script_seg;
  script_seg.ptr = (uint8_t *)script;
  script_seg.size = len;

  if (MolReader_Script_verify(&script_seg, false) != MOL_OK) {
    return ERROR_ENCODING;
  }

  mol_seg_t args_seg = MolReader_Script_get_args(&script_seg);
  mol_seg_t args_bytes_seg = MolReader_Bytes_raw_bytes(&args_seg);
  if (args_bytes_seg.size != SCRIPT_HASH_SIZE) {
    return UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR + ERROR_IDX;
  }

  int owner_mode = 0;
  uint8_t buffer[SCRIPT_HASH_SIZE];
  len = SCRIPT_HASH_SIZE;
  ret = ckb_load_cell_by_field(buffer, &len, 0, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_INPUT, CKB_CELL_FIELD_LOCK_HASH);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR + ERROR_IDX - ret;
  }
  if (len != SCRIPT_HASH_SIZE) {
    return SCRIPT_HASH_SIZE_NOT_CORRECT_ERROR + ERROR_IDX;
  }
  if (memcmp(buffer, args_bytes_seg.ptr, SCRIPT_HASH_SIZE) == 0) {
    owner_mode = 1;
  }

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
      return UDTSWAP_SYSCALL_ERROR + ERROR_IDX - ret;
    }
    if (len != UDTSWAP_LIQUIDITY_UDT_DATA_SIZE) {
      return UDTSWAP_LIQUIDITY_UDT_DATA_SIZE_NOT_CORRECT_ERROR + ERROR_IDX;
    }
    input_amount += current_amount;
    if (input_amount < current_amount) {
      return OVERFLOW_ERROR + ERROR_IDX;
    }
    if (current_amount==0) { // no zero amount
      return UDTSWAP_LIQUIDITY_UDT_ZERO_AMOUNT_ERROR + ERROR_IDX;
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
      return UDTSWAP_SYSCALL_ERROR + ERROR_IDX - ret;
    }
    if (len != UDTSWAP_LIQUIDITY_UDT_DATA_SIZE) {
      return UDTSWAP_LIQUIDITY_UDT_DATA_SIZE_NOT_CORRECT_ERROR + ERROR_IDX;
    }
    output_amount += current_amount;
    if (output_amount < current_amount) {
      return OVERFLOW_ERROR + ERROR_IDX;
    }
    if (current_amount==0) { //no zero output
      return UDTSWAP_LIQUIDITY_UDT_ZERO_AMOUNT_ERROR + ERROR_IDX;
    }
    i += 1;
  }
  //sum output amount

  if (owner_mode==0 && input_amount != output_amount) {
    return UDTSWAP_LIQUIDITY_UDT_INPUT_OUTPUT_NOT_MATCH_ERROR + ERROR_IDX;
  }
  //input amount = output amount
  return CKB_SUCCESS;
}