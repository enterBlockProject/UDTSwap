riscv64-unknown-elf-gcc -c bn.c
ar rc libbn.a bn.o
riscv64-unknown-elf-gcc -o UDTswap_udt_based UDTswap_udt_based.c -L ./ -lbn
riscv64-unknown-elf-gcc -o UDTswap_liquidity_UDT_udt_based UDTswap_liquidity_UDT_udt_based.c -L ./ -lbn
riscv64-unknown-elf-gcc -o UDTswap_lock_udt_based UDTswap_lock_udt_based.c -L ./ -lbn
riscv64-unknown-elf-gcc -o test_udt test_udt.c -L ./ -lbn
