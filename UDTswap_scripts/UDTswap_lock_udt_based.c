#include <memory.h>
#include "ckb_syscalls.h"
#include "udtswap_common.h"

/*
 * @dev check UDTswap type script
 * check UDTswap type script code hash
 * check all 3 lock script hash
 *
 * @param index UDTswap cell index
 * @param current_script_hash_buf UDTswap lock script hash
 */

int check_udtswap_type(size_t index, uint8_t current_script_hash_buf[]) {
  uint8_t script_buf[UDTSWAP_TYPE_SCRIPT_SIZE];
  uint8_t *code_hash_buf;
  uint64_t len = UDTSWAP_TYPE_SCRIPT_SIZE;
  int ret = ckb_load_cell_by_field(script_buf, &len, 0, index, CKB_SOURCE_INPUT, CKB_CELL_FIELD_TYPE);
  if (ret != CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LOCK_ERROR_IDX - ret;
  }
  if (len != UDTSWAP_TYPE_SCRIPT_SIZE) {
    return UDTSWAP_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LOCK_ERROR_IDX;
  }

  code_hash_buf = &script_buf[CODE_HASH_START];

  if (memcmp(code_hash_buf, udtswap_type_script_code_hash_buf, CODE_HASH_SIZE) != 0) {
    return SCRIPT_NOT_MATCH_ERROR - UDTSWAP_LOCK_ERROR_IDX;
  }
  //udtswap type code hash checked

  uint8_t script_buf2[SCRIPT_HASH_SIZE];
  size_t i = 0;
  while(i<3) {
    len = SCRIPT_HASH_SIZE;
    ret = ckb_load_cell_by_field(script_buf2, &len, 0, index + i, CKB_SOURCE_INPUT, CKB_CELL_FIELD_LOCK_HASH);
    if(ret != CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LOCK_ERROR_IDX - ret;
    }
    if(len != SCRIPT_HASH_SIZE) {
      return SCRIPT_HASH_SIZE_NOT_CORRECT_ERROR - UDTSWAP_LOCK_ERROR_IDX;
    }

    if(memcmp(current_script_hash_buf, script_buf2, SCRIPT_HASH_SIZE)!=0) {
      return SCRIPT_NOT_MATCH_ERROR - UDTSWAP_LOCK_ERROR_IDX;
    }
    i+=1;
  }
  //lock script hash checked

  return CKB_SUCCESS;
}

/*
 * @dev check UDTswap lock script
 * check group
 * check UDTswap type script
 */

int main(int argc, char* argv[]) {
  uint64_t len = 0;
  uint8_t script_buf[SCRIPT_HASH_SIZE];
  size_t group_cnt = 1;
  size_t i = 3;
  int ret = ckb_load_cell_by_field(NULL, &len, 0, 3, CKB_SOURCE_GROUP_INPUT, CKB_CELL_FIELD_LOCK_HASH);
  if (ret != INDEX_OUT_OF_BOUND_ERROR) {
    if(ret == CKB_SUCCESS) {
      i = 6;
      while(1) {
        ret = ckb_load_cell_by_field(NULL, &len, 0, i, CKB_SOURCE_GROUP_INPUT, CKB_CELL_FIELD_LOCK_HASH);
        if (ret == INDEX_OUT_OF_BOUND_ERROR) {
          break;
        }
        if (ret != CKB_SUCCESS) {
          return UDTSWAP_SYSCALL_ERROR - UDTSWAP_LOCK_ERROR_IDX;
        }
        i += 3;
      }

      group_cnt = i / 3;
    } else {
      return TOO_MANY_GROUP_CELL_ERROR - UDTSWAP_LOCK_ERROR_IDX;
    }
  }
  len = SCRIPT_HASH_SIZE;
  ret = ckb_load_cell_by_field(script_buf, &len, 0, i - 1, CKB_SOURCE_GROUP_INPUT, CKB_CELL_FIELD_LOCK_HASH);
  if (ret != CKB_SUCCESS) {
    return NOT_ENOUGH_GROUP_CELL_ERROR - UDTSWAP_LOCK_ERROR_IDX;
  }
  //only 3n (same pair, different pools) input with current lock checked

  i = 0;
  while(1) {
    ret = check_udtswap_type(i, script_buf);
    if(ret==CKB_SUCCESS) {
      group_cnt -= 1;
      if(group_cnt == 0) return CKB_SUCCESS;
    }
    if(ret==INDEX_OUT_OF_BOUND_ERROR) {
      break;
    }
    i+=3;
  }

  return CANNOT_UNLOCK_ERROR;
}