#include <memory.h>
#include "ckb_syscalls.h"
#include "protocol.h"
#include "bn.h"
#include "udtswap_common.h"

void uint128_t_to_bignum(uint128_t temp, struct bn *ret) {
  struct bn temp1, temp2;

  bignum_init(&temp1);
  bignum_init(&temp2);
  bignum_init(ret);
  bignum_from_uint64_t(&temp1, temp & 0xffffffffffffffff);
  bignum_from_uint64_t(&temp2, (temp >> 64) & 0xffffffffffffffff);
  _lshift_word(&temp2, 2);

  bignum_add(&temp1, &temp2, ret);
}

uint128_t bignum_to_uint128_t(struct bn *temp) {
  uint128_t ret = 0;
  ret += temp->array[0];
  ret += (uint128_t)temp->array[1] << 32;
  ret += (uint128_t)temp->array[2] << 64;
  ret += (uint128_t)temp->array[3] << 96;
  return ret;
}

/*
 * @dev check adding liquidity
 * second udt amount check with first udt amount
 * receiving user's liquidity check
 *
 * @param u_r1 first udt reserve before adding liquidity
 * @param u_r2 second udt reserve before adding liquidity
 * @param u_r_a1 first udt reserve after adding liquidity
 * @param u_r_a2 second udt reserve after adding liquidity
 * @param t_l total liquidity before adding liquidity
 * @param t_l_a total liquidity after adding liquidity
 */
int add_liquidity(
  uint128_t u_r1,
  uint128_t u_r2,
  uint128_t u_r_a1,
  uint128_t u_r_a2,
  uint128_t t_l,
  uint128_t t_l_a
) {
  struct bn
    temp2,
    temp3,
    udt1_reserve,
    udt2_reserve,
    udt1_amount,
    udt2_amount,
    user_liquidity,
    total_liquidity,
    one
  ;

  bignum_init(&temp2);
  bignum_init(&temp3);
  bignum_init(&udt1_reserve);
  bignum_init(&udt2_reserve);
  bignum_init(&udt1_amount);
  bignum_init(&udt2_amount);
  bignum_init(&user_liquidity);
  bignum_init(&total_liquidity);
  bignum_init(&one);

  uint128_t_to_bignum(u_r1, &udt1_reserve);
  uint128_t_to_bignum(u_r2, &udt2_reserve);
  uint128_t_to_bignum(u_r_a1 - u_r1, &udt1_amount);
  uint128_t_to_bignum(u_r_a2 - u_r2, &udt2_amount);
  uint128_t_to_bignum(t_l_a - t_l, &user_liquidity);
  uint128_t_to_bignum(t_l, &total_liquidity);

  bignum_from_uint64_t(&one, 0x0000000000000001);

  bignum_mul(&udt2_reserve, &udt1_amount, &temp2);
  if (bignum_is_zero(&udt1_reserve) == 1) {
    return DIVIDE_ZERO_ERROR;
  }
  bignum_div(&temp2, &udt1_reserve, &temp3);
  bignum_add(&temp3, &one, &temp2);
  if (bignum_cmp(&temp2, &udt2_amount) != EQUAL) {
    return ADD_LIQUIDITY_NOT_CORRECT_ERROR;
  }
  //udt amount to add liquidity

  bignum_mul(&total_liquidity, &udt1_amount, &temp2);
  bignum_div(&temp2, &udt1_reserve, &temp3); //already checked above
  if (bignum_cmp(&temp3, &user_liquidity) != EQUAL) {
    return LIQUIDITY_NOT_CORRECT_ERROR;
  }
  //user's liquidity amount
  return CKB_SUCCESS;
}

/*
 * @dev check removing liquidity
 * check receiving first udt amount
 * check receiving second udt amount
 *
 * @param u_r1 first udt reserve before removing liquidity
 * @param u_r2 second udt reserve before removing liquidity
 * @param u_r_a1 first udt reserve after removing liquidity
 * @param u_r_a2 second udt reserve after removing liquidity
 * @param t_l total liquidity before removing liquidity
 * @param t_l_a total liquidity after removing liquidity
 */
int remove_liquidity(
  uint128_t u_r1,
  uint128_t u_r2,
  uint128_t u_r_a1,
  uint128_t u_r_a2,
  uint128_t t_l,
  uint128_t t_l_a
) {
  struct bn
    temp2,
    temp3,
    udt1_reserve,
    udt2_reserve,
    udt1_amount,
    udt2_amount,
    user_liquidity,
    total_liquidity
  ;

  bignum_init(&temp2);
  bignum_init(&temp3);
  bignum_init(&udt1_reserve);
  bignum_init(&udt2_reserve);
  bignum_init(&udt1_amount);
  bignum_init(&udt2_amount);
  bignum_init(&user_liquidity);
  bignum_init(&total_liquidity);

  uint128_t_to_bignum(u_r1, &udt1_reserve);
  uint128_t_to_bignum(u_r2, &udt2_reserve);
  uint128_t_to_bignum(u_r1 - u_r_a1, &udt1_amount);
  uint128_t_to_bignum(u_r2 - u_r_a2, &udt2_amount);
  uint128_t_to_bignum(t_l - t_l_a, &user_liquidity);
  uint128_t_to_bignum(t_l, &total_liquidity);

  bignum_mul(&user_liquidity, &udt2_reserve, &temp2);
  if (bignum_is_zero(&total_liquidity) == 1) {
    return DIVIDE_ZERO_ERROR;
  }
  bignum_div(&temp2, &total_liquidity, &temp3);
  if (bignum_cmp(&temp3, &udt2_amount) != EQUAL) {
    return REMOVE_LIQUIDITY_NOT_CORRECT_ERROR;
  }
  //udt amount to receive

  bignum_mul(&user_liquidity, &udt1_reserve, &temp2);
  bignum_div(&temp2, &total_liquidity, &temp3); //already checked above
  if (bignum_cmp(&temp3, &udt1_amount) != EQUAL) {
    return REMOVE_LIQUIDITY_NOT_CORRECT_ERROR;
  }
  //ckb amount to receive
  return CKB_SUCCESS;
}
/*
 * @dev check swapping
 * check input amount calculated by output amount
 * check output amount calculated by input amount
 * if more than one of above are correct, success
 *
 * @param i_r input udt reserve before swapping
 * @param o_r output udt reserve before swapping
 * @param i_r_a input udt reserve after swapping
 * @param o_r_a output udt reserve after swapping
 */
int swap(
  uint128_t i_r,
  uint128_t o_r,
  uint128_t i_r_a,
  uint128_t o_r_a
) {
  int flag = 0;
  struct bn
    temp2,
    temp3,
    temp4,
    temp5,
    input_amount,
    output_amount,
    input_reserve,
    output_reserve,
    thousand,
    except_fee,
    one
  ;

  bignum_init(&temp2);
  bignum_init(&temp3);
  bignum_init(&temp4);
  bignum_init(&temp5);
  bignum_init(&input_amount);
  bignum_init(&input_reserve);
  bignum_init(&output_amount);
  bignum_init(&output_reserve);
  bignum_init(&thousand);
  bignum_init(&except_fee);
  bignum_init(&one);

  uint128_t_to_bignum(i_r_a - i_r, &input_amount);
  uint128_t_to_bignum(i_r, &input_reserve);
  uint128_t_to_bignum(o_r - o_r_a, &output_amount);
  uint128_t_to_bignum(o_r, &output_reserve);

  bignum_from_uint64_t(&thousand, 0x00000000000003e8);
  bignum_from_uint64_t(&except_fee, LIQUIDITY_POOL_EXCEPT_FEE);
  bignum_from_uint64_t(&one, 0x0000000000000001);

  bignum_mul(&input_reserve, &thousand, &temp2);
  bignum_mul(&temp2, &output_amount, &temp3);
  if (bignum_cmp(&output_reserve, &output_amount) == SMALLER) {
    return SUBTRACT_ERROR;
  }
  bignum_sub(&output_reserve, &output_amount, &temp4);
  bignum_mul(&temp4, &except_fee, &temp5);
  if (bignum_is_zero(&temp5) == 1) {
    return DIVIDE_ZERO_ERROR;
  }
  bignum_div(&temp3, &temp5, &temp4);
  bignum_add(&temp4, &one, &temp5);
  if (bignum_cmp(&temp5, &input_amount) != EQUAL) {
    flag = 1;
  }
  //input amount by output amount

  bignum_mul(&input_amount, &except_fee, &temp3);
  bignum_mul(&temp3, &output_reserve, &temp4);
  bignum_add(&temp2, &temp3, &temp5);
  if (bignum_is_zero(&temp5) == 1) {
    return DIVIDE_ZERO_ERROR;
  }
  bignum_div(&temp4, &temp5, &temp2);
  if (bignum_cmp(&temp2, &output_amount) != EQUAL && flag==1) {
    return SWAP_NOT_CORRECT_ERROR;
  }
  //output amount by input amount
  return CKB_SUCCESS;
}

int check_tx_input() {
  uint64_t len = 0;
  int ret = 0;

  unsigned char input[INPUT_SIZE];
  uint64_t input_len = INPUT_SIZE;
  ret = ckb_load_input(input, &input_len, 0, 0, CKB_SOURCE_INPUT);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if (input_len > INPUT_SIZE) {
    return INPUT_TOO_LONG_ERROR;
  }

  unsigned char script[SCRIPT_SIZE];
  len = SCRIPT_SIZE;
  ret = ckb_load_script(script, &len, 0);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if (len > SCRIPT_SIZE) {
    return UDTSWAP_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR;
  }
  mol_seg_t script_seg;
  script_seg.ptr = (uint8_t *)script;
  script_seg.size = len;

  if (MolReader_Script_verify(&script_seg, false) != MOL_OK) {
    return ERROR_ENCODING;
  }

  mol_seg_t args_seg = MolReader_Script_get_args(&script_seg);
  mol_seg_t args_bytes_seg = MolReader_Bytes_raw_bytes(&args_seg);

  if ((input_len == args_bytes_seg.size) &&
      (memcmp(args_bytes_seg.ptr, input, input_len) == 0)) {
    return CKB_SUCCESS;
  }
  return INPUT_NOT_MATCH_ERROR;
}

int check_fee(size_t index, size_t cnt) {
  uint8_t fee_script_hash[SCRIPT_HASH_SIZE];
  uint64_t len = SCRIPT_HASH_SIZE;
  int ret = ckb_load_cell_by_field(fee_script_hash, &len, 0, index, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_LOCK_HASH);
  if(ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if(memcmp(fee_lock_hash, fee_script_hash, SCRIPT_HASH_SIZE) != 0) {
    return SCRIPT_NOT_MATCH_ERROR;
  }

  ret = ckb_load_cell_by_field(fee_script_hash, &len, 0, index, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
  if(ret != ITEM_MISSING_ERROR) {
    return STATE_USE_FEE_CELL_TYPE_SCRIPT_EXIST_ERROR;
  }

  uint64_t capacity_64;
  uint128_t capacity;
  len = 8;
  ret = ckb_load_cell_by_field((uint8_t *)&capacity_64, &len, 0, index, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_CAPACITY);
  if(ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  capacity = (uint128_t)capacity_64;

  uint128_t total_fee = (uint128_t)STATE_USE_FEE * (uint128_t)cnt;

  if(capacity != total_fee) {
    return STATE_USE_FEE_NOT_CORRECT_ERROR;
  }

  return CKB_SUCCESS;
}

int check_script_hash(uint8_t compare_script_hash_buf[], size_t index, size_t source, size_t field) {
  uint64_t len = SCRIPT_HASH_SIZE;
  uint8_t script_hash_buf[SCRIPT_HASH_SIZE];
  int ret = ckb_load_cell_by_field(script_hash_buf, &len, 0, index, source, field);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if (len != SCRIPT_HASH_SIZE) {
    return SCRIPT_HASH_SIZE_NOT_CORRECT_ERROR;
  }
  if(memcmp(compare_script_hash_buf, script_hash_buf, SCRIPT_HASH_SIZE) != 0) {
    return SCRIPT_NOT_MATCH_ERROR;
  }
  return CKB_SUCCESS;
}

/*
 * @dev check UDTswap defaults
 * check lock code hash, lock hash all same
 * check udt type hash
 * check udtswap udts reserve and udts locked amount same
 * check udtswap script hash input, output same
 * check type hash, type code hash
 *
 * @param index UDTswap cell index
 * @param is_ckb1 first udt is CKB or not
 * @param is_ckb2 second udt is CKB or not
 * @param udt1_reserve_before first udt reserve input
 * @param udt1_reserve_after first udt reserve output
 * @param udt2_reserve_before second udt reserve input
 * @param udt2_reserve_after second udt reserve output
 * @param total_liquidity_before total liquidity input
 * @param total_liquidity_after total liquidity output
 */
int udtswap_default_check(
  size_t index,
  int *is_ckb1,
  int *is_ckb2,
  uint128_t *udt1_reserve_before,
  uint128_t *udt1_reserve_after,
  uint128_t *udt2_reserve_before,
  uint128_t *udt2_reserve_after,
  uint128_t *total_liquidity_before,
  uint128_t *total_liquidity_after
) {
  uint8_t script_buf[UDTSWAP_LOCK_SCRIPT_SIZE];

  uint8_t *lock_code_hash_buf;
  uint8_t *udt1_type_script_hash_buf;
  uint8_t *udt2_type_script_hash_buf;

  uint64_t len = UDTSWAP_LOCK_SCRIPT_SIZE;
  int ret = ckb_load_cell_by_field(script_buf, &len, 0, index, CKB_SOURCE_INPUT, CKB_CELL_FIELD_LOCK);
  if (ret != CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if (len != UDTSWAP_LOCK_SCRIPT_SIZE) {
    return UDTSWAP_LOCK_SCRIPT_SIZE_NOT_CORRECT_ERROR;
  }

  lock_code_hash_buf = &script_buf[CODE_HASH_START];
  udt1_type_script_hash_buf = &script_buf[UDTSWAP_LOCK_ARGS_UDT1_SCRIPT_HASH_START];
  udt2_type_script_hash_buf = &script_buf[UDTSWAP_LOCK_ARGS_UDT2_SCRIPT_HASH_START];

  if(memcmp(lock_code_hash_buf, udtswap_lock_code_hash_buf, CODE_HASH_SIZE) != 0) {
    return CODE_HASH_NOT_MATCH_ERROR;
  }

  uint8_t current_lock_script_hash_buf[SCRIPT_HASH_SIZE];
  len = SCRIPT_HASH_SIZE;
  ret = ckb_load_cell_by_field(current_lock_script_hash_buf, &len, 0, index, CKB_SOURCE_INPUT, CKB_CELL_FIELD_LOCK_HASH);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }

  ret = check_script_hash(current_lock_script_hash_buf, index + 1, CKB_SOURCE_INPUT, CKB_CELL_FIELD_LOCK_HASH);
  if (ret != CKB_SUCCESS) {
    return ret;
  }

  ret = check_script_hash(current_lock_script_hash_buf, index + 2, CKB_SOURCE_INPUT, CKB_CELL_FIELD_LOCK_HASH);
  if (ret != CKB_SUCCESS) {
    return ret;
  }

  ret = check_script_hash(current_lock_script_hash_buf, index, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_LOCK_HASH);
  if (ret != CKB_SUCCESS) {
    return ret;
  }

  ret = check_script_hash(current_lock_script_hash_buf, index + 1, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_LOCK_HASH);
  if (ret != CKB_SUCCESS) {
    return ret;
  }

  ret = check_script_hash(current_lock_script_hash_buf, index + 2, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_LOCK_HASH);
  if (ret != CKB_SUCCESS) {
    return ret;
  }

  // lock code hash, lock hash all same checked

  uint8_t udtswap_input_data_buf[UDTSWAP_DATA_SIZE];
  len = UDTSWAP_DATA_SIZE;
  ret = ckb_load_cell_data(udtswap_input_data_buf, &len, 0, index, CKB_SOURCE_INPUT);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if (len != UDTSWAP_DATA_SIZE) {
    return UDTSWAP_DATA_SIZE_NOT_CORRECT_ERROR;
  }

  uint8_t udtswap_output_data_buf[UDTSWAP_DATA_SIZE];
  len = UDTSWAP_DATA_SIZE;
  ret = ckb_load_cell_data(udtswap_output_data_buf, &len, 0, index, CKB_SOURCE_OUTPUT);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if (len != UDTSWAP_DATA_SIZE) {
    return UDTSWAP_DATA_SIZE_NOT_CORRECT_ERROR;
  }

  int isCKB1 = 0;
  if(memcmp(udt1_type_script_hash_buf, udt_type_ckb_script_hash_buf, SCRIPT_HASH_SIZE)==0) {
    isCKB1 = 1;
  }
  int isCKB2 = 0;
  if(memcmp(udt2_type_script_hash_buf, udt_type_ckb_script_hash_buf, SCRIPT_HASH_SIZE)==0) {
    isCKB2 = 1;
  }

  if(isCKB1) {
    len = 0;
    ret = ckb_load_cell_by_field(NULL, &len, 0, index+1, CKB_SOURCE_INPUT, CKB_CELL_FIELD_TYPE_HASH);
    if (ret != ITEM_MISSING_ERROR) {
      return SCRIPT_NOT_MATCH_ERROR;
    }

    len = 0;
    ret = ckb_load_cell_by_field(NULL, &len, 0, index+1, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
    if (ret != ITEM_MISSING_ERROR) {
      return SCRIPT_NOT_MATCH_ERROR;
    }
  } else {
    ret = check_script_hash(udt1_type_script_hash_buf, index+1, CKB_SOURCE_INPUT, CKB_CELL_FIELD_TYPE_HASH);
    if(ret!=CKB_SUCCESS) {
      return ret;
    }

    ret = check_script_hash(udt1_type_script_hash_buf, index+1, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
    if(ret!=CKB_SUCCESS) {
      return ret;
    }
  }

  if(isCKB2) {
    len = 0;
    ret = ckb_load_cell_by_field(NULL, &len, 0, index+2, CKB_SOURCE_INPUT, CKB_CELL_FIELD_TYPE_HASH);
    if (ret != ITEM_MISSING_ERROR) {
      return SCRIPT_NOT_MATCH_ERROR;
    }

    len = 0;
    ret = ckb_load_cell_by_field(NULL, &len, 0, index+2, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
    if (ret != ITEM_MISSING_ERROR) {
      return SCRIPT_NOT_MATCH_ERROR;
    }
  } else {
    ret = check_script_hash(udt2_type_script_hash_buf, index+2, CKB_SOURCE_INPUT, CKB_CELL_FIELD_TYPE_HASH);
    if(ret!=CKB_SUCCESS) {
      return ret;
    }

    ret = check_script_hash(udt2_type_script_hash_buf, index+2, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
    if(ret!=CKB_SUCCESS) {
      return ret;
    }
  }

  //udt type hash checked

  uint128_t udtswap_udt1_amount_before = get_uint128_t(UDTSWAP_DATA_UDT1_RESERVE_START, udtswap_input_data_buf);
  uint128_t udtswap_udt1_amount_after = get_uint128_t(UDTSWAP_DATA_UDT1_RESERVE_START, udtswap_output_data_buf);
  uint128_t udtswap_udt2_amount_before = get_uint128_t(UDTSWAP_DATA_UDT2_RESERVE_START, udtswap_input_data_buf);
  uint128_t udtswap_udt2_amount_after = get_uint128_t(UDTSWAP_DATA_UDT2_RESERVE_START, udtswap_output_data_buf);

  if(isCKB1) {
    uint64_t ckb_reserve_64;
    uint128_t ckb_reserve;
    len = 8;
    ret = ckb_load_cell_by_field((uint8_t *)&ckb_reserve_64, &len, 0, index+1, CKB_SOURCE_INPUT, CKB_CELL_FIELD_CAPACITY);
    if(ret!=CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    ckb_reserve = (uint128_t)ckb_reserve_64;
    if(udtswap_udt1_amount_before!=ckb_reserve) {
      return UDTSWAP_TYPE_UDTSWAP_UDT_LOCK_AMOUNT_NOT_MATCH_ERROR;
    }

    len = 8;
    ret = ckb_load_cell_by_field((uint8_t *)&ckb_reserve_64, &len, 0, index+1, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_CAPACITY);
    if(ret!=CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    ckb_reserve = (uint128_t)ckb_reserve_64;
    if(udtswap_udt1_amount_after!=ckb_reserve) {
      return UDTSWAP_TYPE_UDTSWAP_UDT_LOCK_AMOUNT_NOT_MATCH_ERROR;
    }
  } else {
    uint8_t udt1_amount_before_buf[UDT_AMOUNT_SIZE];
    len = UDT_AMOUNT_SIZE;
    ret = ckb_load_cell_data(udt1_amount_before_buf, &len, 0, index + 1, CKB_SOURCE_INPUT);
    if(ret != CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    uint128_t udt1_amount_before = get_uint128_t(0, udt1_amount_before_buf);

    if (udtswap_udt1_amount_before != udt1_amount_before) {
      return UDTSWAP_TYPE_UDTSWAP_UDT_LOCK_AMOUNT_NOT_MATCH_ERROR;
    }

    uint8_t udt1_amount_after_buf[UDT_AMOUNT_SIZE];
    len = UDT_AMOUNT_SIZE;
    ret = ckb_load_cell_data(udt1_amount_after_buf, &len, 0, index + 1, CKB_SOURCE_OUTPUT);
    if(ret != CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    uint128_t udt1_amount_after = get_uint128_t(0, udt1_amount_after_buf);

    if (udtswap_udt1_amount_after != udt1_amount_after) {
      return UDTSWAP_TYPE_UDTSWAP_UDT_LOCK_AMOUNT_NOT_MATCH_ERROR;
    }
  }

  if(isCKB2) {
    uint64_t ckb_reserve_64;
    uint128_t ckb_reserve;
    len = 8;
    ret = ckb_load_cell_by_field((uint8_t *)&ckb_reserve_64, &len, 0, index+2, CKB_SOURCE_INPUT, CKB_CELL_FIELD_CAPACITY);
    if(ret!=CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    ckb_reserve = (uint128_t)ckb_reserve_64;
    if(udtswap_udt2_amount_before!=ckb_reserve) {
      return UDTSWAP_TYPE_UDTSWAP_UDT_LOCK_AMOUNT_NOT_MATCH_ERROR;
    }

    len = 8;
    ret = ckb_load_cell_by_field((uint8_t *)&ckb_reserve_64, &len, 0, index+2, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_CAPACITY);
    if(ret!=CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    ckb_reserve = (uint128_t)ckb_reserve_64;
    if(udtswap_udt2_amount_after!=ckb_reserve) {
      return UDTSWAP_TYPE_UDTSWAP_UDT_LOCK_AMOUNT_NOT_MATCH_ERROR;
    }
  } else {
    uint8_t udt2_amount_before_buf[UDT_AMOUNT_SIZE];
    len = UDT_AMOUNT_SIZE;
    ret = ckb_load_cell_data(udt2_amount_before_buf, &len, 0, index + 2, CKB_SOURCE_INPUT);
    if(ret != CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    uint128_t udt2_amount_before = get_uint128_t(0, udt2_amount_before_buf);

    if (udtswap_udt2_amount_before != udt2_amount_before) {
      return UDTSWAP_TYPE_UDTSWAP_UDT_LOCK_AMOUNT_NOT_MATCH_ERROR;
    }

    uint8_t udt2_amount_after_buf[UDT_AMOUNT_SIZE];
    len = UDT_AMOUNT_SIZE;
    ret = ckb_load_cell_data(udt2_amount_after_buf, &len, 0, index + 2, CKB_SOURCE_OUTPUT);
    if(ret != CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    uint128_t udt2_amount_after = get_uint128_t(0, udt2_amount_after_buf);

    if (udtswap_udt2_amount_after != udt2_amount_after) {
      return UDTSWAP_TYPE_UDTSWAP_UDT_LOCK_AMOUNT_NOT_MATCH_ERROR;
    }
  }

  //udtswap udts reserve and udts locked amount same checked

  uint8_t type_script_buf[UDTSWAP_TYPE_SCRIPT_SIZE];
  uint8_t *type_code_hash_buf;

  len = UDTSWAP_TYPE_SCRIPT_SIZE;
  ret = ckb_load_cell_by_field(type_script_buf, &len, 0, index, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if (len != UDTSWAP_TYPE_SCRIPT_SIZE) {
    return UDTSWAP_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR;
  }
  type_code_hash_buf = &type_script_buf[CODE_HASH_START];

  if(memcmp(type_code_hash_buf, udtswap_type_script_code_hash_buf, CODE_HASH_SIZE) != 0) {
    return CODE_HASH_NOT_MATCH_ERROR;
  }
  //udtswap type script code hash check

  uint8_t script_hash_buf1[SCRIPT_HASH_SIZE];
  len = SCRIPT_HASH_SIZE;
  ret = ckb_load_cell_by_field(script_hash_buf1, &len, 0, index, CKB_SOURCE_INPUT, CKB_CELL_FIELD_TYPE_HASH);
  if(ret!=CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }

  uint8_t script_hash_buf2[SCRIPT_HASH_SIZE];
  len = SCRIPT_HASH_SIZE;
  ret = ckb_load_cell_by_field(script_hash_buf2, &len, 0, index, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
  if(ret!=CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if(memcmp(script_hash_buf1, script_hash_buf2, SCRIPT_HASH_SIZE)!=0) {
    return SCRIPT_NOT_MATCH_ERROR;
  }

  //udtswap script hash input, output same checked

  *udt1_reserve_before = udtswap_udt1_amount_before;
  *udt1_reserve_after = udtswap_udt1_amount_after;
  *udt2_reserve_before = udtswap_udt2_amount_before;
  *udt2_reserve_after = udtswap_udt2_amount_after;
  *total_liquidity_before = get_uint128_t(UDTSWAP_DATA_TOTAL_LIQUIDITY_START, udtswap_input_data_buf);
  *total_liquidity_after = get_uint128_t(UDTSWAP_DATA_TOTAL_LIQUIDITY_START, udtswap_output_data_buf);
  *is_ckb1 = isCKB1;
  *is_ckb2 = isCKB2;

  uint8_t current_script_hash_buf[SCRIPT_HASH_SIZE];
  len = SCRIPT_HASH_SIZE;
  ret = ckb_load_script_hash(current_script_hash_buf, &len, 0);
  if (ret!=CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }

  if(memcmp(current_script_hash_buf, script_hash_buf1, SCRIPT_HASH_SIZE)!=0) {
    return ONLY_TYPE_SCRIPT_NOT_MATCH_ERROR; //all checked but only type script hash is different (udtswap, but not current script)
  }

  //type hash all checked
  //all checked

  return CKB_SUCCESS;
}

/*
 * @dev check creating new pool
 * check tx first input
 * check type group
 * check type script hash
 * check lock code hash
 * check first udt and second udt not same
 * check lock script hash
 * check first, second udt type hash
 * check udt reserve, lock amount
 * check empty udt reserve
 * check empty total liquidity
 */
int create_udtswap_check() {
  int ret = check_tx_input();
  if (ret!=CKB_SUCCESS) {
    return ret;
  }

  uint64_t len=0;
  ret = ckb_load_cell_by_field(NULL, &len, 0, 0, CKB_SOURCE_GROUP_INPUT, CKB_CELL_FIELD_TYPE_HASH);
  if (ret != INDEX_OUT_OF_BOUND_ERROR) {
    return TOO_MANY_GROUP_CELL_ERROR;
  }

  ret = ckb_load_cell_by_field(NULL, &len, 0, 0, CKB_SOURCE_GROUP_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
  if (ret != CKB_SUCCESS) {
    return NOT_ENOUGH_GROUP_CELL_ERROR;
  }

  ret = ckb_load_cell_by_field(NULL, &len, 0, 1, CKB_SOURCE_GROUP_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
  if (ret != INDEX_OUT_OF_BOUND_ERROR) {
    return TOO_MANY_GROUP_CELL_ERROR;
  }
  //udtswap group should be no input 1 output

  len = SCRIPT_HASH_SIZE;
  uint8_t current_script_hash_buf[SCRIPT_HASH_SIZE];
  ret = ckb_load_script_hash(current_script_hash_buf, &len, 0);
  if (ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }

  ret = check_script_hash(current_script_hash_buf, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
  if (ret != CKB_SUCCESS) {
    return ret;
  }

  //udtswap type hash checked

  uint8_t *lock_code_hash_buf;
  uint8_t *udt1_type_script_hash_buf;
  uint8_t *udt2_type_script_hash_buf;

  uint8_t script_buf[UDTSWAP_LOCK_SCRIPT_SIZE];
  len = UDTSWAP_LOCK_SCRIPT_SIZE;
  ret = ckb_load_cell_by_field(script_buf, &len, 0, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_LOCK);
  if (ret!=CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if (len != UDTSWAP_LOCK_SCRIPT_SIZE) {
    return UDTSWAP_LOCK_SCRIPT_SIZE_NOT_CORRECT_ERROR;
  }

  lock_code_hash_buf = &script_buf[CODE_HASH_START];
  udt1_type_script_hash_buf = &script_buf[UDTSWAP_LOCK_ARGS_UDT1_SCRIPT_HASH_START];
  udt2_type_script_hash_buf = &script_buf[UDTSWAP_LOCK_ARGS_UDT2_SCRIPT_HASH_START];

  if (memcmp(lock_code_hash_buf, udtswap_lock_code_hash_buf, CODE_HASH_SIZE) != 0) {
    return CODE_HASH_NOT_MATCH_ERROR;
  }

  //udtswap lock code hash checked

  if (memcmp(udt1_type_script_hash_buf, udt2_type_script_hash_buf, SCRIPT_HASH_SIZE) >= 0) {
    return SAME_UDT_OR_ORDER_ERROR;
  }

  //not same udt, order checked

  uint8_t lock_script_hash_buf[SCRIPT_HASH_SIZE];
  len = SCRIPT_HASH_SIZE;
  ret = ckb_load_cell_by_field(lock_script_hash_buf, &len, 0, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_LOCK_HASH);
  if(ret!=CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }

  ret = check_script_hash(lock_script_hash_buf, UDTSWAP_UDT_LOCK_CELL_INDEX_1, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_LOCK_HASH);
  if(ret!=CKB_SUCCESS) {
    return ret;
  }

  ret = check_script_hash(lock_script_hash_buf, UDTSWAP_UDT_LOCK_CELL_INDEX_2, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_LOCK_HASH);
  if(ret!=CKB_SUCCESS) {
    return ret;
  }

  //udtswap lock hash checked
  int isCKB1 = 0;
  if(memcmp(udt1_type_script_hash_buf, udt_type_ckb_script_hash_buf, SCRIPT_HASH_SIZE)==0) {
    isCKB1 = 1;
    len = 0;
    ret = ckb_load_cell_by_field(NULL, &len, 0, UDTSWAP_UDT_LOCK_CELL_INDEX_1, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
    if (ret!=ITEM_MISSING_ERROR) {
        return SCRIPT_NOT_MATCH_ERROR;
    }
  } else {
    ret = check_script_hash(udt1_type_script_hash_buf, UDTSWAP_UDT_LOCK_CELL_INDEX_1, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
    if(ret!=CKB_SUCCESS) {
      return ret;
    }
  }

  int isCKB2 = 0;
  if(memcmp(udt2_type_script_hash_buf, udt_type_ckb_script_hash_buf, SCRIPT_HASH_SIZE)==0) {
    isCKB2 = 1;
    len = 0;
    ret = ckb_load_cell_by_field(NULL, &len, 0, UDTSWAP_UDT_LOCK_CELL_INDEX_2, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
    if (ret!=ITEM_MISSING_ERROR) {
        return SCRIPT_NOT_MATCH_ERROR;
    }
  } else {
    ret = check_script_hash(udt2_type_script_hash_buf, UDTSWAP_UDT_LOCK_CELL_INDEX_2, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
    if(ret!=CKB_SUCCESS) {
      return ret;
    }
  }

  //udt type hash checked

  uint8_t udtswap_data_buf[UDTSWAP_DATA_SIZE];
  len = UDTSWAP_DATA_SIZE;
  ret = ckb_load_cell_data(udtswap_data_buf, &len, 0, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_OUTPUT);
  if (ret!=CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if(len!=UDTSWAP_DATA_SIZE) {
    return UDTSWAP_DATA_SIZE_NOT_CORRECT_ERROR;
  }
  uint128_t udtswap_udt1_reserve = get_uint128_t(UDTSWAP_DATA_UDT1_RESERVE_START, udtswap_data_buf);
  uint128_t udtswap_udt2_reserve = get_uint128_t(UDTSWAP_DATA_UDT2_RESERVE_START, udtswap_data_buf);
  uint128_t udtswap_total_liquidity = get_uint128_t(UDTSWAP_DATA_TOTAL_LIQUIDITY_START, udtswap_data_buf);

  uint64_t udt_amount_64;
  uint128_t udt1_amount = 0;
  uint8_t udt_data_buf[UDT_AMOUNT_SIZE];
  if(isCKB1) {
    len = 8;
    ret = ckb_load_cell_by_field((uint8_t *)&udt_amount_64, &len, 0, UDTSWAP_UDT_LOCK_CELL_INDEX_1, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_CAPACITY);
    if(ret!=CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    udt1_amount = (uint128_t)udt_amount_64;
  } else {
    ret = ckb_load_cell_data(udt_data_buf, &len, 0, UDTSWAP_UDT_LOCK_CELL_INDEX_1, CKB_SOURCE_OUTPUT);
    if(ret!=CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    udt1_amount = get_uint128_t(0, udt_data_buf);
  }

  uint128_t udt2_amount = 0;
  if(isCKB2) {
    len = 8;
    ret = ckb_load_cell_by_field((uint8_t *)&udt_amount_64, &len, 0, UDTSWAP_UDT_LOCK_CELL_INDEX_2, CKB_SOURCE_OUTPUT, CKB_CELL_FIELD_CAPACITY);
    if(ret!=CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    udt2_amount = (uint128_t)udt_amount_64;
  } else {
    ret = ckb_load_cell_data(udt_data_buf, &len, 0, UDTSWAP_UDT_LOCK_CELL_INDEX_2, CKB_SOURCE_OUTPUT);
    if(ret!=CKB_SUCCESS) {
      return UDTSWAP_SYSCALL_ERROR - ret;
    }
    udt2_amount = get_uint128_t(0, udt_data_buf);
  }

  if(
    udtswap_udt1_reserve != udt1_amount ||
    udtswap_udt2_reserve != udt2_amount ||
    udt1_amount != (isCKB1 ? CKB_RESERVE_DEFAULT : UDT_RESERVE_DEFAULT) ||
    udt2_amount != (isCKB2 ? CKB_RESERVE_DEFAULT : UDT_RESERVE_DEFAULT) ||
    udtswap_total_liquidity != 0
  ) {
    return RESULT_NOT_CORRECT_ERROR;
  }
  //udtswap udts reserve, udts amount same checked
  //ckb reserve default checked
  //udt reserve default checked
  //total liquidity default checked

  return CKB_SUCCESS;
}

/*
 * @dev check UDTswap liquidity udt script
 * check tx input
 * check lock script hash (owner mode)
 *
 * @param index UDTswap liquidity udt cell index
 * @param source UDTswap liquidity udt cell source
 */
int check_liquidity_udt_script(size_t index, size_t source) {
  uint8_t script_buf[UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE];
  uint8_t *script_code_hash_buf;
  uint8_t *script_args_lock_hash_buf;
  uint8_t *script_args_tx_input_buf;
  uint64_t len = UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE;
  int ret = ckb_load_cell_by_field(script_buf, &len, 0, index, source, CKB_CELL_FIELD_TYPE);
  if(ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if(len != UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE) {
    return UDTSWAP_LIQUIDITY_UDT_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR;
  }

  script_code_hash_buf = &script_buf[CODE_HASH_START];
  script_args_lock_hash_buf = &script_buf[ARGS_START];
  script_args_tx_input_buf = &script_buf[UDTSWAP_LIQUIDITY_UDT_ARGS_TX_INPUT_START];

  if(memcmp(udtswap_liquidity_udt_code_hash_buf, script_code_hash_buf, CODE_HASH_SIZE) != 0) {
    return CODE_HASH_NOT_MATCH_ERROR;
  }
  //udtswap liquidity udt code hash checked

  uint8_t script_buf2[UDTSWAP_TYPE_SCRIPT_SIZE];
  uint8_t *script_args_tx_input_buf2;
  len = UDTSWAP_TYPE_SCRIPT_SIZE;
  ret = ckb_load_cell_by_field(script_buf2, &len, 0, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_INPUT, CKB_CELL_FIELD_TYPE);
  if(ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if(len != UDTSWAP_TYPE_SCRIPT_SIZE) {
    return UDTSWAP_TYPE_SCRIPT_SIZE_NOT_CORRECT_ERROR;
  }

  script_args_tx_input_buf2 = &script_buf2[ARGS_START];

  if(memcmp(script_args_tx_input_buf, script_args_tx_input_buf2, TX_INPUT_SIZE) != 0) {
    return TX_INPUT_NOT_MATCH_ERROR;
  }
  //udtswap tx input and udtswap liquidity udt tx input same checked

  uint8_t script_hash_buf[SCRIPT_HASH_SIZE];
  len = SCRIPT_HASH_SIZE;
  ret = ckb_load_cell_by_field(script_hash_buf, &len, 0, UDTSWAP_TYPE_CELL_INDEX, CKB_SOURCE_INPUT, CKB_CELL_FIELD_LOCK_HASH);
  if(ret != CKB_SUCCESS) {
    return UDTSWAP_SYSCALL_ERROR - ret;
  }
  if(len != SCRIPT_HASH_SIZE) {
    return SCRIPT_HASH_SIZE_NOT_CORRECT_ERROR;
  }

  if(memcmp(script_hash_buf, script_args_lock_hash_buf, SCRIPT_HASH_SIZE) != 0) {
    return SCRIPT_NOT_MATCH_ERROR;
  }
  //udtswap lock hash and udtswap liquidity owner lock same checked

  return CKB_SUCCESS;
}

/*
 * @dev check UDTswap
 * check pool creation
 * check group
 * check UDTswap default for all UDTswap type scripts
 * check swap, add liquidity, remove liquidity
 * check fee
 */

int main(int argc, char* argv[]) {
  int ret = create_udtswap_check();
  if (ret==CKB_SUCCESS) {
    return ret;
  }
  //udtswap creation checked

  uint64_t len = 0;
  ret = ckb_load_cell_by_field(NULL, &len, 0, 0, CKB_SOURCE_GROUP_INPUT, CKB_CELL_FIELD_TYPE_HASH);
  if (ret != CKB_SUCCESS) {
    return NOT_ENOUGH_GROUP_CELL_ERROR;
  }

  len = 0;
  ret = ckb_load_cell_by_field(NULL, &len, 0, 1, CKB_SOURCE_GROUP_INPUT, CKB_CELL_FIELD_TYPE_HASH);
  if (ret != INDEX_OUT_OF_BOUND_ERROR) {
    return TOO_MANY_GROUP_CELL_ERROR;
  }

  len = 0;
  ret = ckb_load_cell_by_field(NULL, &len, 0, 0, CKB_SOURCE_GROUP_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
  if (ret != CKB_SUCCESS) {
    return NOT_ENOUGH_GROUP_CELL_ERROR;
  }

  len = 0;
  ret = ckb_load_cell_by_field(NULL, &len, 0, 1, CKB_SOURCE_GROUP_OUTPUT, CKB_CELL_FIELD_TYPE_HASH);
  if (ret != INDEX_OUT_OF_BOUND_ERROR) {
    return TOO_MANY_GROUP_CELL_ERROR;
  }
  //udtswap group should be 1 input and 1 output

  int is_success = 0;
  int is_ckb1=0, is_ckb2=0;
  uint128_t udt1_reserve_before, udt1_reserve_after, udt2_reserve_before, udt2_reserve_after, total_liquidity_before, total_liquidity_after;
  size_t i=0;
  while(1) {
    ret = udtswap_default_check(
      i,
      &is_ckb1,
      &is_ckb2,
      &udt1_reserve_before,
      &udt1_reserve_after,
      &udt2_reserve_before,
      &udt2_reserve_after,
      &total_liquidity_before,
      &total_liquidity_after
    );
    if(ret==ONLY_TYPE_SCRIPT_NOT_MATCH_ERROR) {
      i += 3;
      continue;
    }
    if(ret!=CKB_SUCCESS) {
      if(is_success) {
        break;
      }
      return ret;
    }
    uint128_t udt1_default = (is_ckb1 ? CKB_RESERVE_DEFAULT : UDT_RESERVE_DEFAULT);
    uint128_t udt2_default = (is_ckb2 ? CKB_RESERVE_DEFAULT : UDT_RESERVE_DEFAULT);
    if(
      udt1_reserve_before < udt1_default ||
      udt1_reserve_after <= udt1_default ||
      udt2_reserve_before < udt2_default ||
      udt2_reserve_after <= udt2_default
    ) {
      return RESERVE_BELOW_MINIMUM_ERROR;
    }
    udt1_reserve_before -= udt1_default;
    udt1_reserve_after -= udt1_default;
    udt2_reserve_before -= udt2_default;
    udt2_reserve_after -= udt2_default;

    if(total_liquidity_before == total_liquidity_after) { //swap
      if(
        udt1_reserve_before == 0 ||
        udt2_reserve_before == 0
      ) {
        return RESERVE_BELOW_MINIMUM_ERROR;
      }
      if (total_liquidity_before == 0) {
        return LIQUIDITY_EMPTY_ERROR;
      }

      if(
        udt1_reserve_before < udt1_reserve_after &&
        udt2_reserve_before > udt2_reserve_after
      ) {
        ret = swap(
          udt1_reserve_before,
          udt2_reserve_before,
          udt1_reserve_after,
          udt2_reserve_after
        );
        if(ret!=CKB_SUCCESS) {
          return ret;
        }
      } else if (
        udt1_reserve_before > udt1_reserve_after &&
        udt2_reserve_before < udt2_reserve_after
      ) {
        ret = swap(
          udt2_reserve_before,
          udt1_reserve_before,
          udt2_reserve_after,
          udt1_reserve_after
        );
        if(ret!=CKB_SUCCESS) {
          return ret;
        }
      } else {
        return RESULT_NOT_CORRECT_ERROR;
      }

      is_success = 1; //pass

    } else {
      if(i!=0) {
        return UDTSWAP_NOT_MATCH_ERROR; //only first udtswap can add or remove liquidity
      }
      if(total_liquidity_before < total_liquidity_after) { //add liquidity
        if(
          udt1_reserve_after <= udt1_reserve_before ||
          udt2_reserve_after <= udt2_reserve_before
        ) {
          return RESULT_NOT_CORRECT_ERROR;
        }

        ret = check_liquidity_udt_script(ADD_LIQUIDITY_CELL_INDEX, CKB_SOURCE_OUTPUT);
        if(ret != CKB_SUCCESS) {
          return ret;
        }
        //udtswap liquidity udt script checked

        if (total_liquidity_before == 0) {
          if(udt1_reserve_after < ADD_LIQUIDITY_MINIMUM) {
            return ADD_LIQUIDITY_TOO_LOW_ERROR;
          }
          if(total_liquidity_after != udt1_reserve_after) {
            return LIQUIDITY_NOT_CORRECT_ERROR;
          }
          //total liquidity initial = udt1 reserve initial
        } else {
          if(udt1_reserve_after - udt1_reserve_before < ADD_LIQUIDITY_MINIMUM) {
            return ADD_LIQUIDITY_TOO_LOW_ERROR;
          }
          ret = add_liquidity(
            udt1_reserve_before,
            udt2_reserve_before,
            udt1_reserve_after,
            udt2_reserve_after,
            total_liquidity_before,
            total_liquidity_after
          );
        }
      } else { //remove liquidity
        if(
          udt1_reserve_before == 0 ||
          udt2_reserve_before == 0
        ) {
          return RESERVE_BELOW_MINIMUM_ERROR;
        }
        if (total_liquidity_before == 0) {
          return LIQUIDITY_EMPTY_ERROR;
        }
        if(
          udt1_reserve_after >= udt1_reserve_before ||
          udt2_reserve_after >= udt2_reserve_before
        ) {
          return RESULT_NOT_CORRECT_ERROR;
        }

        ret = check_liquidity_udt_script(REMOVE_LIQUIDITY_CELL_START_INDEX, CKB_SOURCE_INPUT);
        if(ret != CKB_SUCCESS) {
          return ret;
        }
        //udtswap liquidity udt script checked

        ret = remove_liquidity(
          udt1_reserve_before,
          udt2_reserve_before,
          udt1_reserve_after,
          udt2_reserve_after,
          total_liquidity_before,
          total_liquidity_after
        );
      }
      if(ret!=CKB_SUCCESS) {
        return ret;
      }
      i+=3;
      break;
    }
    i += 3;
  }

  ret = check_fee(i, i / 3);
  if(ret!=CKB_SUCCESS) {
    return ret;
  }
  //fee checked

  return CKB_SUCCESS;
}