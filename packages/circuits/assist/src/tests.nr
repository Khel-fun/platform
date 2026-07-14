use dep::card_actions::next_pow02;

#[test]
fn test_next_pow02_exact_powers() {
    // 1 = 2^0
    let (next, exp) = next_pow02::<32>(1);
    assert_eq(next, 1);
    assert_eq(exp, 0);

    // 2 = 2^1
    let (next2, exp2) = next_pow02::<32>(2);
    assert_eq(next2, 2);
    assert_eq(exp2, 1);

    // 4 = 2^2
    let (next4, exp4) = next_pow02::<32>(4);
    assert_eq(next4, 4);
    assert_eq(exp4, 2);

    // 16 = 2^4
    let (next16, exp16) = next_pow02::<32>(16);
    assert_eq(next16, 16);
    assert_eq(exp16, 4);

    // 32 = 2^5
    let (next32, exp32) = next_pow02::<32>(32);
    assert_eq(next32, 32);
    assert_eq(exp32, 5);
}

#[test]
fn test_next_pow02_non_powers() {
    // 3 -> 4 = 2^2
    let (next3, exp3) = next_pow02::<32>(3);
    assert_eq(next3, 4);
    assert_eq(exp3, 2);

    // 5 -> 8 = 2^3
    let (next5, exp5) = next_pow02::<32>(5);
    assert_eq(next5, 8);
    assert_eq(exp5, 3);

    // 6 -> 8 = 2^3
    let (next6, exp6) = next_pow02::<32>(6);
    assert_eq(next6, 8);
    assert_eq(exp6, 3);

    // 14 (PLAY_CARD_PER_PLAYER_COUNT*2) -> 16 = 2^4
    let (next14, exp14) = next_pow02::<32>(14);
    assert_eq(next14, 16);
    assert_eq(exp14, 4);

    // 52 (STANDARD_DECK_SIZE) -> 64 = 2^6
    let (next52, exp52) = next_pow02::<32>(52);
    assert_eq(next52, 64);
    assert_eq(exp52, 6);
}

#[test]
fn test_next_pow02_returned_value_is_power_of_two() {
    let (next3, _) = next_pow02::<32>(3);
    assert((next3 & (next3 - 1)) == 0);

    let (next7, _) = next_pow02::<32>(7);
    assert((next7 & (next7 - 1)) == 0);

    let (next52, _) = next_pow02::<32>(52);
    assert((next52 & (next52 - 1)) == 0);
}

#[test]
fn test_next_pow02_exponent_consistent_with_value() {
    let (next3, exp3) = next_pow02::<32>(3);
    assert_eq(1 << exp3, next3);

    let (next14, exp14) = next_pow02::<32>(14);
    assert_eq(1 << exp14, next14);

    let (next52, exp52) = next_pow02::<32>(52);
    assert_eq(1 << exp52, next52);

    let (next1, exp1) = next_pow02::<32>(1);
    assert_eq(1 << exp1, next1);
}

#[test(should_fail_with = "[ERR: zk] value must be greater than 0")]
fn test_next_pow02_zero_panics() {
    let _ = next_pow02::<32>(0);
}
