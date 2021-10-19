#include <stdbool.h>
#include "bn.h"

/* Functions for shifting number in-place. */
static void _lshift_one_bit(struct bn* a);
static void _rshift_one_bit(struct bn* a);



/* Public / Exported functions. */
void bignum_init(struct bn* n)
{
  require(n, "n is null");

  int i;
  for (i = 0; i < BN_ARRAY_SIZE; ++i)
  {
    n->array[i] = 0;
  }
}


void bignum_from_uint64_t(struct bn* n, DTYPE_TMP i)
{
  require(n, "n is null");

  bignum_init(n);

  /* Endianness issue if machine is not little-endian? */
#ifdef WORD_SIZE
 #if (WORD_SIZE == 1)
  n->array[0] = (i & 0x00000000000000ff);
  n->array[1] = (i & 0x000000000000ff00) >> 8;
  n->array[2] = (i & 0x0000000000ff0000) >> 16;
  n->array[3] = (i & 0x00000000ff000000) >> 24;
  n->array[4] = (i & 0x000000ff00000000) >> 32;
  n->array[5] = (i & 0x0000ff0000000000) >> 40;
  n->array[6] = (i & 0x00ff000000000000) >> 48;
  n->array[7] = (i & 0xff00000000000000) >> 56;
 #elif (WORD_SIZE == 2)
  n->array[0] = (i & 0x000000000000ffff);
  n->array[1] = (i & 0x00000000ffff0000) >> 16;
  n->array[2] = (i & 0x0000ffff00000000) >> 32;
  n->array[3] = (i & 0xffff000000000000) >> 48;
 #elif (WORD_SIZE == 4)
  n->array[0] = (i & 0x00000000ffffffff);
  n->array[1] = (i & 0xffffffff00000000) >> 32;
 #endif
#endif
}


uint64_t bignum_to_uint64_t(struct bn* n)
{
  require(n, "n is null");

  uint64_t ret = 0;

  /* Endianness issue if machine is not little-endian? */
#if (WORD_SIZE == 1)
  ret += n->array[0];
  ret += (DTYPE_TMP)n->array[1] << 8;
  ret += (DTYPE_TMP)n->array[2] << 16;
  ret += (DTYPE_TMP)n->array[3] << 24;
  ret += (DTYPE_TMP)n->array[4] << 32;
  ret += (DTYPE_TMP)n->array[5] << 40;
  ret += (DTYPE_TMP)n->array[6] << 48;
  ret += (DTYPE_TMP)n->array[7] << 56;
#elif (WORD_SIZE == 2)
  ret += n->array[0];
  ret += (DTYPE_TMP)n->array[1] << 16;
  ret += (DTYPE_TMP)n->array[2] << 32;
  ret += (DTYPE_TMP)n->array[3] << 48;
#elif (WORD_SIZE == 4)
  ret += n->array[0];
  ret += (DTYPE_TMP)n->array[1] << 32;
#endif

  return ret;
}

void bignum_add(struct bn* a, struct bn* b, struct bn* c)
{
  require(a, "a is null");
  require(b, "b is null");
  require(c, "c is null");

  DTYPE_TMP tmp;
  int carry = 0;
  int i;
  for (i = 0; i < BN_ARRAY_SIZE; ++i)
  {
    tmp = (DTYPE_TMP)a->array[i] + b->array[i] + carry;
    carry = (tmp > MAX_VAL);
    c->array[i] = (tmp & MAX_VAL);
  }
}


void bignum_sub(struct bn* a, struct bn* b, struct bn* c)
{
  require(a, "a is null");
  require(b, "b is null");
  require(c, "c is null");

  DTYPE_TMP res;
  DTYPE_TMP tmp1;
  DTYPE_TMP tmp2;
  int borrow = 0;
  int i;
  for (i = 0; i < BN_ARRAY_SIZE; ++i)
  {
    tmp1 = (DTYPE_TMP)a->array[i] + (MAX_VAL + 1); /* + number_base */
    tmp2 = (DTYPE_TMP)b->array[i] + borrow;;
    res = (tmp1 - tmp2);
    c->array[i] = (DTYPE)(res & MAX_VAL); /* "modulo number_base" == "% (number_base - 1)" if number_base is 2^N */
    borrow = (res <= MAX_VAL);
  }
}


void bignum_mul(struct bn* a, struct bn* b, struct bn* c)
{
  require(a, "a is null");
  require(b, "b is null");
  require(c, "c is null");

  struct bn row;
  struct bn tmp;
  int i, j;

  bignum_init(c);

  for (i = 0; i < BN_ARRAY_SIZE; ++i)
  {
    bignum_init(&row);

    for (j = 0; j < BN_ARRAY_SIZE; ++j)
    {
      if (i + j < BN_ARRAY_SIZE)
      {
        bignum_init(&tmp);
        DTYPE_TMP intermediate = ((DTYPE_TMP)a->array[i] * (DTYPE_TMP)b->array[j]);
        bignum_from_uint64_t(&tmp, intermediate);
        _lshift_word(&tmp, i + j);
        bignum_add(&tmp, &row, &row);
      }
    }
    bignum_add(c, &row, c);
  }
}


void bignum_div(struct bn* a, struct bn* b, struct bn* c)
{
  require(a, "a is null");
  require(b, "b is null");
  require(c, "c is null");

  struct bn current;
  struct bn denom;
  struct bn tmp;

  bignum_from_uint64_t(&current, 1);               // int current = 1;
  bignum_assign(&denom, b);                   // denom = b
  bignum_assign(&tmp, a);                     // tmp   = a

  const DTYPE_TMP half_max = 1 + (DTYPE_TMP)(MAX_VAL / 2);
  bool overflow = false;
  while (bignum_cmp(&denom, a) != LARGER)     // while (denom <= a) {
  {
    if (denom.array[BN_ARRAY_SIZE - 1] >= half_max)
    {
      overflow = true;
      break;
    }
    _lshift_one_bit(&current);                //   current <<= 1;
    _lshift_one_bit(&denom);                  //   denom <<= 1;
  }
  if (!overflow)
  {
    _rshift_one_bit(&denom);                  // denom >>= 1;
    _rshift_one_bit(&current);                // current >>= 1;
  }
  bignum_init(c);                             // int answer = 0;

  while (!bignum_is_zero(&current))           // while (current != 0)
  {
    if (bignum_cmp(&tmp, &denom) != SMALLER)  //   if (dividend >= denom)
    {
      bignum_sub(&tmp, &denom, &tmp);         //     dividend -= denom;
      bignum_or(c, &current, c);              //     answer |= current;
    }
    _rshift_one_bit(&current);                //   current >>= 1;
    _rshift_one_bit(&denom);                  //   denom >>= 1;
  }                                           // return answer;
}

void bignum_or(struct bn* a, struct bn* b, struct bn* c)
{
  require(a, "a is null");
  require(b, "b is null");
  require(c, "c is null");

  int i;
  for (i = 0; i < BN_ARRAY_SIZE; ++i)
  {
    c->array[i] = (a->array[i] | b->array[i]);
  }
}


int bignum_cmp(struct bn* a, struct bn* b)
{
  require(a, "a is null");
  require(b, "b is null");

  int i = BN_ARRAY_SIZE;
  do
  {
    i -= 1; /* Decrement first, to start with last array element */
    if (a->array[i] > b->array[i])
    {
      return LARGER;
    }
    else if (a->array[i] < b->array[i])
    {
      return SMALLER;
    }
  }
  while (i != 0);

  return EQUAL;
}


int bignum_is_zero(struct bn* n)
{
  require(n, "n is null");

  int i;
  for (i = 0; i < BN_ARRAY_SIZE; ++i)
  {
    if (n->array[i])
    {
      return 0;
    }
  }

  return 1;
}


void bignum_assign(struct bn* dst, struct bn* src)
{
  require(dst, "dst is null");
  require(src, "src is null");

  int i;
  for (i = 0; i < BN_ARRAY_SIZE; ++i)
  {
    dst->array[i] = src->array[i];
  }
}

void _lshift_word(struct bn* a, int nwords)
{
  require(a, "a is null");
  require(nwords >= 0, "no negative shifts");

  int i;
  /* Shift whole words */
  for (i = (BN_ARRAY_SIZE - 1); i >= nwords; --i)
  {
    a->array[i] = a->array[i - nwords];
  }
  /* Zero pad shifted words. */
  for (; i >= 0; --i)
  {
    a->array[i] = 0;
  }
}


static void _lshift_one_bit(struct bn* a)
{
  require(a, "a is null");

  int i;
  for (i = (BN_ARRAY_SIZE - 1); i > 0; --i)
  {
    a->array[i] = (a->array[i] << 1) | (a->array[i - 1] >> ((8 * WORD_SIZE) - 1));
  }
  a->array[0] <<= 1;
}


static void _rshift_one_bit(struct bn* a)
{
  require(a, "a is null");

  int i;
  for (i = 0; i < (BN_ARRAY_SIZE - 1); ++i)
  {
    a->array[i] = (a->array[i] >> 1) | (a->array[i + 1] << ((8 * WORD_SIZE) - 1));
  }
  a->array[BN_ARRAY_SIZE - 1] >>= 1;
}