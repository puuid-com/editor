import { m } from '#/paraglide/messages'
import { getCommandCapability } from 'zplr/web'
import type { CommandCapability, ZplCommandNode, ZplDocument } from 'zplr/web'

/**
 * Plain-language explanations of ZPL for people who don't read it: what a
 * command does, what each of its values means, and a one-line summary of
 * what every field puts on the label.
 */

export interface ExplainContext {
  /** Nominal printer dpi, to turn dots into inches. */
  dpi: number
}

export interface ParameterExplanation {
  name: string
  /** As written, or null when left out. */
  value: string | null
  meaning: string
  /** Which comma-separated value of the command this row comes from. */
  rawIndex: number
}

export interface CommandExplanation {
  canonical: string
  name: string
  summary: string
  parameters: ParameterExplanation[]
  capability: CommandCapability | undefined
}

/** A short sentence shown at the source offset of what it describes. */
export interface ExplainHint {
  offset: number
  text: string
}

type Describe = (value: string, context: ExplainContext) => string

interface ParameterGuide {
  name: string
  describe?: Describe
  /** Said when the value is left out. */
  fallback?: string
}

interface CommandGuide {
  /** Used where zplr only knows the command as "Recognized ZPL command". */
  name?: string
  summary: string
  parameters?: readonly ParameterGuide[]
  /** The whole parameter string is one value: field data has commas in it. */
  raw?: string
  /** One line for the command when it stands outside a field. */
  hint?: (values: Values, context: ExplainContext) => string | null
}

type Values = ReadonlyArray<string | undefined>

// Value describers ----------------------------------------------------------

function formatNumber(value: number) {
  return Number(value.toFixed(2)).toString()
}

function dots(value: string, { dpi }: ExplainContext) {
  const number = Number(value)
  if (!Number.isFinite(number))
    return m.zpl_help_value0_dots_1({ value0: String(value) })
  const unit = number === 1 ? m.zpl_help_dot_2() : m.zpl_help_dots_3()
  return m.zpl_help_value0_value1_value2_in_4({
    value0: String(value),
    value1: String(unit),
    value2: String(formatNumber(number / dpi)),
  })
}

const fromLeft: Describe = (value, context) =>
  m.zpl_help_value0_from_the_left_edge_5({
    value0: String(dots(value, context)),
  })
const fromTop: Describe = (value, context) =>
  m.zpl_help_value0_from_the_top_edge_6({
    value0: String(dots(value, context)),
  })

const ORIENTATIONS: Partial<Record<string, string>> = {
  N: m.zpl_help_normal_7(),
  R: m.zpl_help_rotated_90_clockwise_8(),
  I: m.zpl_help_upside_down_9(),
  B: m.zpl_help_rotated_90_counter_clockwise_10(),
}

const orientation: Describe = (value) =>
  ORIENTATIONS[value.toUpperCase()] ??
  m.zpl_help_value0_not_a_known_orientation_11({ value0: String(value) })

function yesNo(yes: string, no: string): Describe {
  return (value) => {
    const upper = value.toUpperCase()
    if (upper === 'Y') return yes
    if (upper === 'N') return no
    return m.zpl_help_value0_should_be_y_or_n_12({ value0: String(value) })
  }
}

function choice(options: Partial<Record<string, string>>): Describe {
  return (value) => options[value.toUpperCase()] ?? `“${value}”`
}

const ENCODINGS: Partial<Record<string, string>> = {
  '0': m.zpl_help_usa_1_the_printer_s_original_character_set_13(),
  '27': m.zpl_help_windows_1252_14(),
  '28': m.zpl_help_utf_8_so_any_character_works_15(),
  '29': m.zpl_help_utf_16_big_endian_16(),
  '30': m.zpl_help_utf_16_little_endian_17(),
  '31': m.zpl_help_zebra_code_page_1252_18(),
  '33': m.zpl_help_code_page_1250_19(),
  '34': m.zpl_help_code_page_1251_20(),
  '35': m.zpl_help_code_page_1253_21(),
  '36': m.zpl_help_code_page_1254_22(),
  '37': m.zpl_help_code_page_1255_23(),
}

const encoding: Describe = (value) =>
  ENCODINGS[value] ??
  (Number(value) <= 13
    ? m.zpl_help_international_character_set_value0_24({
        value0: String(value),
      })
    : m.zpl_help_character_set_value0_25({ value0: String(value) }))

const fontName: Describe = (value) =>
  value === '0'
    ? m.zpl_help_font_0_the_built_in_scalable_font_26()
    : /^[A-Z]$/i.test(value)
      ? m.zpl_help_built_in_bitmap_font_value0_27({
          value0: String(value.toUpperCase()),
        })
      : m.zpl_help_font_value0_28({ value0: String(value) })

const colour = choice({ B: m.zpl_help_black_29(), W: m.zpl_help_white_30() })

// Shared parameter lists -----------------------------------------------------

const POSITION: readonly ParameterGuide[] = [
  { name: 'x', describe: fromLeft, fallback: m.zpl_help_left_edge_31() },
  { name: 'y', describe: fromTop, fallback: m.zpl_help_top_edge_32() },
  {
    name: m.zpl_help_justify_33(),
    describe: choice({
      '0': m.zpl_help_left_aligned_34(),
      '1': m.zpl_help_right_aligned_x_is_the_right_end_35(),
      '2': m.zpl_help_aligned_automatically_for_the_script_36(),
    }),
    fallback: m.zpl_help_left_aligned_37(),
  },
]

const BARCODE_ORIENTATION: ParameterGuide = {
  name: m.zpl_help_orientation_38(),
  describe: orientation,
  fallback: m.zpl_help_the_fw_default_normally_upright_39(),
}
const BARCODE_HEIGHT: ParameterGuide = {
  name: m.zpl_help_height_40(),
  describe: (value, context) =>
    m.zpl_help_bars_are_value0_tall_41({
      value0: String(dots(value, context)),
    }),
  fallback: m.zpl_help_the_height_set_by_by_42(),
}
const HUMAN_READABLE: ParameterGuide = {
  name: m.zpl_help_text_line_43(),
  describe: yesNo(
    m.zpl_help_prints_the_content_as_text_too_44(),
    m.zpl_help_no_text_only_the_bars_45(),
  ),
  fallback: m.zpl_help_prints_the_content_as_text_too_46(),
}
const TEXT_ABOVE: ParameterGuide = {
  name: m.zpl_help_text_above_47(),
  describe: yesNo(
    m.zpl_help_the_text_goes_above_the_bars_48(),
    m.zpl_help_the_text_goes_below_49(),
  ),
  fallback: m.zpl_help_below_the_bars_50(),
}
const CHECK_DIGIT: ParameterGuide = {
  name: m.zpl_help_check_digit_51(),
  describe: yesNo(
    m.zpl_help_adds_a_check_digit_52(),
    m.zpl_help_no_extra_check_digit_53(),
  ),
  fallback: m.zpl_help_no_extra_check_digit_54(),
}

const LINEAR_BARCODE: readonly ParameterGuide[] = [
  BARCODE_ORIENTATION,
  BARCODE_HEIGHT,
  HUMAN_READABLE,
  TEXT_ABOVE,
]

const SHAPE_THICKNESS: ParameterGuide = {
  name: m.zpl_help_thickness_55(),
  describe: (value, context) =>
    m.zpl_help_outline_is_value0_thick_56({
      value0: String(dots(value, context)),
    }),
  fallback: m.zpl_help_1_dot_57(),
}
const SHAPE_COLOUR: ParameterGuide = {
  name: m.zpl_help_colour_58(),
  describe: colour,
  fallback: m.zpl_help_black_59(),
}

// The guide ----------------------------------------------------------------

const GUIDES: Partial<Record<string, CommandGuide>> = {
  '^XA': {
    summary: m.zpl_help_starts_a_label_everything_up_to_the_next_xz_desc_60(),
    hint: () => m.zpl_help_start_of_label_61(),
  },
  '^XZ': {
    summary: m.zpl_help_ends_the_label_the_printer_prints_it_when_it_rea_62(),
    hint: () => m.zpl_help_end_of_label_63(),
  },
  '^FX': {
    summary: m.zpl_help_a_comment_a_note_for_people_reading_the_code_not_64(),
    raw: m.zpl_help_note_65(),
  },

  // Label setup
  '^PW': {
    summary: m.zpl_help_sets_how_wide_the_label_is_66(),
    parameters: [{ name: m.zpl_help_width_67(), describe: dots }],
    hint: ([width], context) =>
      width
        ? m.zpl_help_label_is_value0_wide_68({
            value0: String(dots(width, context)),
          })
        : null,
  },
  '^LL': {
    summary: m.zpl_help_sets_how_long_tall_the_label_is_69(),
    parameters: [{ name: m.zpl_help_length_70(), describe: dots }],
    hint: ([length], context) =>
      length
        ? m.zpl_help_label_is_value0_long_71({
            value0: String(dots(length, context)),
          })
        : null,
  },
  '^LH': {
    summary: m.zpl_help_moves_the_starting_corner_every_position_after_i_72(),
    parameters: [
      { name: 'x', describe: fromLeft, fallback: m.zpl_help_left_edge_73() },
      { name: 'y', describe: fromTop, fallback: m.zpl_help_top_edge_74() },
    ],
    hint: ([x = '0', y = '0']) =>
      m.zpl_help_positions_below_start_from_value0_value1_75({
        value0: String(x),
        value1: String(y),
      }),
  },
  '^LS': {
    summary: m.zpl_help_shifts_everything_on_the_label_left_or_right_76(),
    parameters: [
      {
        name: m.zpl_help_shift_77(),
        describe: (value, context) =>
          m.zpl_help_value0_negative_moves_left_78({
            value0: String(dots(value, context)),
          }),
      },
    ],
  },
  '^LT': {
    summary: m.zpl_help_moves_everything_on_the_label_up_or_down_79(),
    parameters: [
      {
        name: m.zpl_help_shift_80(),
        describe: (value, context) =>
          m.zpl_help_value0_negative_moves_up_81({
            value0: String(dots(value, context)),
          }),
      },
    ],
  },
  '^LR': {
    summary: m.zpl_help_inverts_the_whole_label_black_prints_white_and_w_82(),
    parameters: [
      {
        name: m.zpl_help_invert_83(),
        describe: yesNo(
          m.zpl_help_inverted_84(),
          m.zpl_help_printed_normally_85(),
        ),
        fallback: m.zpl_help_printed_normally_86(),
      },
    ],
    hint: ([value]) =>
      value?.toUpperCase() === 'Y'
        ? m.zpl_help_whole_label_printed_inverted_87()
        : null,
  },
  '^PO': {
    summary: m.zpl_help_prints_the_whole_label_right_side_up_or_upside_d_88(),
    parameters: [
      {
        name: m.zpl_help_orientation_89(),
        describe: choice({
          N: m.zpl_help_right_side_up_90(),
          I: m.zpl_help_upside_down_91(),
        }),
        fallback: m.zpl_help_right_side_up_92(),
      },
    ],
    hint: ([value]) =>
      value?.toUpperCase() === 'I'
        ? m.zpl_help_whole_label_printed_upside_down_93()
        : null,
  },
  '^PM': {
    summary: m.zpl_help_mirrors_the_whole_label_as_if_seen_in_a_mirror_94(),
    parameters: [
      {
        name: m.zpl_help_mirror_95(),
        describe: yesNo(m.zpl_help_mirrored_96(), m.zpl_help_not_mirrored_97()),
        fallback: m.zpl_help_not_mirrored_98(),
      },
    ],
    hint: ([value]) =>
      value?.toUpperCase() === 'Y'
        ? m.zpl_help_whole_label_mirrored_99()
        : null,
  },
  '^PQ': {
    summary: m.zpl_help_sets_how_many_copies_of_this_label_to_print_100(),
    parameters: [
      { name: m.zpl_help_copies_101(), fallback: '1' },
      {
        name: m.zpl_help_pause_every_102(),
        fallback: m.zpl_help_never_pauses_103(),
      },
      { name: m.zpl_help_repeats_104(), fallback: '0' },
      {
        name: m.zpl_help_no_pause_105(),
        describe: yesNo(
          m.zpl_help_never_pauses_106(),
          m.zpl_help_pauses_as_set_107(),
        ),
        fallback: m.zpl_help_pauses_as_set_108(),
      },
    ],
    hint: ([copies = '1']) =>
      m.zpl_help_print_value0_value1_109({
        value0: String(copies),
        value1: String(
          copies === '1' ? m.zpl_help_copy() : m.zpl_help_copies(),
        ),
      }),
  },
  '^MU': {
    summary: m.zpl_help_sets_the_unit_every_size_and_position_after_it_i_110(),
    parameters: [
      {
        name: m.zpl_help_unit_111(),
        describe: choice({
          D: m.zpl_help_dots_112(),
          I: m.zpl_help_inches_113(),
          M: m.zpl_help_millimetres_114(),
        }),
        fallback: m.zpl_help_dots_115(),
      },
    ],
    hint: ([unit]) =>
      unit
        ? m.zpl_help_sizes_below_are_in_value0_116({
            value0: String(
              choice({
                D: m.zpl_help_dots_112(),
                I: m.zpl_help_inches_113(),
                M: m.zpl_help_millimetres_114(),
              })(unit, {
                dpi: 0,
              }),
            ),
          })
        : null,
  },
  '^MD': {
    name: m.zpl_help_media_darkness_117(),
    summary: m.zpl_help_makes_the_print_darker_or_lighter_on_top_of_the__118(),
    parameters: [
      {
        name: m.zpl_help_change_119(),
        describe: (value) =>
          m.zpl_help_value0_from_30_to_30_120({ value0: String(value) }),
      },
    ],
    hint: ([value]) =>
      value
        ? m.zpl_help_print_darkness_value0_121({ value0: String(value) })
        : null,
  },
  '~SD': {
    name: m.zpl_help_set_darkness_122(),
    summary: m.zpl_help_sets_how_dark_the_printer_prints_from_0_to_30_123(),
    parameters: [{ name: m.zpl_help_darkness_124() }],
    hint: ([value]) =>
      value
        ? m.zpl_help_print_darkness_value0_125({ value0: String(value) })
        : null,
  },
  '^PR': {
    name: m.zpl_help_print_rate_126(),
    summary: m.zpl_help_sets_how_fast_the_label_moves_through_the_printe_127(),
    parameters: [
      {
        name: m.zpl_help_print_speed_128(),
        describe: (value) =>
          m.zpl_help_value0_inches_a_second_129({ value0: String(value) }),
      },
      {
        name: m.zpl_help_feed_speed_130(),
        describe: (value) =>
          m.zpl_help_value0_inches_a_second_131({ value0: String(value) }),
      },
      {
        name: m.zpl_help_backfeed_speed_132(),
        describe: (value) =>
          m.zpl_help_value0_inches_a_second_133({ value0: String(value) }),
      },
    ],
    hint: ([speed]) =>
      speed
        ? m.zpl_help_print_speed_value0_in_s_134({ value0: String(speed) })
        : null,
  },
  '^MN': {
    summary: m.zpl_help_tells_the_printer_how_to_find_where_one_label_en_135(),
    parameters: [
      {
        name: m.zpl_help_media_136(),
        describe: choice({
          N: m.zpl_help_continuous_roll_no_gaps_137(),
          Y: m.zpl_help_labels_with_gaps_between_them_138(),
          W: m.zpl_help_labels_with_gaps_between_them_139(),
          M: m.zpl_help_labels_with_a_black_mark_on_the_back_140(),
          A: m.zpl_help_detected_automatically_141(),
        }),
      },
    ],
  },
  '^MT': {
    summary: m.zpl_help_tells_the_printer_whether_it_prints_with_a_ribbo_142(),
    parameters: [
      {
        name: m.zpl_help_type_143(),
        describe: choice({
          T: m.zpl_help_thermal_transfer_with_a_ribbon_144(),
          D: m.zpl_help_direct_thermal_heat_sensitive_labels_without_a_r_145(),
        }),
      },
    ],
  },
  '^MM': {
    summary: m.zpl_help_sets_what_the_printer_does_after_a_label_tear_of_146(),
    parameters: [
      {
        name: m.zpl_help_mode_147(),
        describe: choice({
          T: m.zpl_help_tear_off_148(),
          P: m.zpl_help_peel_off_149(),
          R: m.zpl_help_rewind_150(),
          C: m.zpl_help_cut_151(),
          A: m.zpl_help_applicator_152(),
          D: m.zpl_help_delayed_cut_153(),
          K: m.zpl_help_kiosk_154(),
        }),
      },
    ],
  },
  '^CI': {
    summary: m.zpl_help_picks_the_character_set_text_is_read_in_28_utf_8_155(),
    parameters: [{ name: m.zpl_help_character_set_156(), describe: encoding }],
    hint: ([value]) =>
      value
        ? m.zpl_help_text_encoding_value0_157({
            value0: String(encoding(value, { dpi: 0 })),
          })
        : null,
  },
  '^FW': {
    summary: m.zpl_help_sets_the_default_direction_for_every_text_and_ba_158(),
    parameters: [
      {
        name: m.zpl_help_orientation_159(),
        describe: orientation,
        fallback: m.zpl_help_normal_160(),
      },
      {
        name: m.zpl_help_justify_161(),
        describe: choice({
          '0': m.zpl_help_left_162(),
          '1': m.zpl_help_right_163(),
          '2': m.zpl_help_automatic_164(),
        }),
        fallback: m.zpl_help_left_165(),
      },
    ],
    hint: ([value]) =>
      value
        ? m.zpl_help_text_and_barcodes_below_are_value0_166({
            value0: String(orientation(value, { dpi: 0 })),
          })
        : null,
  },

  // Text
  '^CF': {
    summary: m.zpl_help_sets_the_default_font_and_size_for_text_after_it_167(),
    parameters: [
      {
        name: m.zpl_help_font_168(),
        describe: fontName,
        fallback: m.zpl_help_unchanged_169(),
      },
      {
        name: m.zpl_help_height_170(),
        describe: (value, context) =>
          m.zpl_help_letters_value0_tall_171({
            value0: String(dots(value, context)),
          }),
        fallback: m.zpl_help_unchanged_172(),
      },
      {
        name: m.zpl_help_width_173(),
        describe: (value, context) =>
          m.zpl_help_letters_value0_wide_174({
            value0: String(dots(value, context)),
          }),
        fallback: m.zpl_help_in_proportion_to_the_height_175(),
      },
    ],
    hint: ([font, height]) =>
      [
        m.zpl_help_text_below_uses_176(),
        font !== undefined
          ? m.zpl_help_font_value0_177({ value0: String(font) })
          : m.zpl_help_the_same_font_178(),
        height
          ? m.zpl_help_at_value0_dots_tall_179({ value0: String(height) })
          : '',
      ]
        .filter(Boolean)
        .join(' '),
  },
  '^A': {
    summary: m.zpl_help_picks_the_font_and_size_for_the_next_text_only_t_180(),
    parameters: [
      { name: m.zpl_help_font_181(), describe: fontName },
      {
        name: m.zpl_help_orientation_182(),
        describe: orientation,
        fallback: m.zpl_help_the_fw_default_normally_upright_183(),
      },
      {
        name: m.zpl_help_height_184(),
        describe: (value, context) =>
          m.zpl_help_letters_value0_tall_185({
            value0: String(dots(value, context)),
          }),
        fallback: m.zpl_help_the_cf_default_186(),
      },
      {
        name: m.zpl_help_width_187(),
        describe: (value, context) =>
          m.zpl_help_letters_value0_wide_188({
            value0: String(dots(value, context)),
          }),
        fallback: m.zpl_help_in_proportion_to_the_height_189(),
      },
    ],
  },
  '^A@': {
    summary: m.zpl_help_picks_a_font_stored_on_the_printer_by_its_file_n_190(),
    parameters: [
      {
        name: m.zpl_help_orientation_191(),
        describe: orientation,
        fallback: m.zpl_help_normal_192(),
      },
      {
        name: m.zpl_help_height_193(),
        describe: (value, context) =>
          m.zpl_help_letters_value0_tall_194({
            value0: String(dots(value, context)),
          }),
      },
      {
        name: m.zpl_help_width_195(),
        describe: (value, context) =>
          m.zpl_help_letters_value0_wide_196({
            value0: String(dots(value, context)),
          }),
        fallback: m.zpl_help_in_proportion_to_the_height_197(),
      },
      {
        name: m.zpl_help_file_198(),
        describe: (value) =>
          m.zpl_help_the_font_file_value0_199({ value0: String(value) }),
      },
    ],
  },
  '^FB': {
    summary: m.zpl_help_wraps_the_next_text_into_a_block_of_a_set_width__200(),
    parameters: [
      {
        name: m.zpl_help_width_201(),
        describe: (value, context) =>
          m.zpl_help_block_is_value0_wide_202({
            value0: String(dots(value, context)),
          }),
      },
      { name: m.zpl_help_max_lines_203(), fallback: '1' },
      {
        name: m.zpl_help_line_spacing_204(),
        describe: (value, context) =>
          m.zpl_help_value0_extra_between_lines_205({
            value0: String(dots(value, context)),
          }),
        fallback: m.zpl_help_no_extra_space_206(),
      },
      {
        name: m.zpl_help_align_207(),
        describe: choice({
          L: m.zpl_help_left_208(),
          C: m.zpl_help_centred_209(),
          R: m.zpl_help_right_210(),
          J: m.zpl_help_justified_211(),
        }),
        fallback: m.zpl_help_left_212(),
      },
      {
        name: m.zpl_help_indent_213(),
        describe: (value, context) =>
          m.zpl_help_lines_after_the_first_are_indented_value0_214({
            value0: String(dots(value, context)),
          }),
        fallback: m.zpl_help_no_indent_215(),
      },
    ],
  },
  '^FH': {
    summary: m.zpl_help_lets_the_next_fd_write_special_characters_as_hex_216(),
    parameters: [
      { name: m.zpl_help_marker_217(), fallback: m.zpl_help_underscore_218() },
    ],
  },

  // Fields
  '^FO': {
    summary: m.zpl_help_sets_where_the_next_item_goes_its_top_left_corne_219(),
    parameters: POSITION,
  },
  '^FT': {
    summary: m.zpl_help_sets_where_the_next_item_goes_like_fo_but_measur_220(),
    parameters: POSITION,
  },
  '^FD': {
    summary: m.zpl_help_the_content_of_the_item_the_words_to_print_or_wh_221(),
    raw: m.zpl_help_content_222(),
  },
  '^FV': {
    summary: m.zpl_help_like_fd_but_the_content_can_change_between_copie_223(),
    raw: m.zpl_help_content_224(),
  },
  '^FS': {
    summary: m.zpl_help_ends_the_current_item_every_item_on_the_label_fi_225(),
  },
  '^FR': {
    summary: m.zpl_help_prints_this_item_inverted_white_where_it_overlap_226(),
  },
  '^FN': {
    summary: m.zpl_help_gives_the_item_a_number_so_a_template_can_fill_i_227(),
    parameters: [{ name: m.zpl_help_number_228() }],
  },
  '^FM': {
    summary: m.zpl_help_places_the_same_item_at_several_positions_229(),
  },

  // Shapes
  '^GB': {
    summary: m.zpl_help_draws_a_box_make_it_as_thick_as_it_is_tall_and_i_230(),
    parameters: [
      {
        name: m.zpl_help_width_231(),
        describe: (value, context) =>
          m.zpl_help_value0_wide_232({ value0: String(dots(value, context)) }),
        fallback: m.zpl_help_as_wide_as_it_is_thick_233(),
      },
      {
        name: m.zpl_help_height_234(),
        describe: (value, context) =>
          m.zpl_help_value0_tall_235({ value0: String(dots(value, context)) }),
        fallback: m.zpl_help_as_tall_as_it_is_thick_236(),
      },
      SHAPE_THICKNESS,
      SHAPE_COLOUR,
      {
        name: m.zpl_help_rounding_237(),
        describe: (value) =>
          value === '0'
            ? m.zpl_help_square_corners_238()
            : m.zpl_help_rounded_corners_value0_of_8_239({
                value0: String(value),
              }),
        fallback: m.zpl_help_square_corners_240(),
      },
    ],
  },
  '^GC': {
    summary: m.zpl_help_draws_a_circle_241(),
    parameters: [
      {
        name: m.zpl_help_diameter_242(),
        describe: (value, context) =>
          m.zpl_help_value0_across_243({
            value0: String(dots(value, context)),
          }),
      },
      SHAPE_THICKNESS,
      SHAPE_COLOUR,
    ],
  },
  '^GE': {
    summary: m.zpl_help_draws_an_ellipse_an_oval_244(),
    parameters: [
      {
        name: m.zpl_help_width_245(),
        describe: (value, context) =>
          m.zpl_help_value0_wide_246({ value0: String(dots(value, context)) }),
      },
      {
        name: m.zpl_help_height_247(),
        describe: (value, context) =>
          m.zpl_help_value0_tall_248({ value0: String(dots(value, context)) }),
      },
      SHAPE_THICKNESS,
      SHAPE_COLOUR,
    ],
  },
  '^GD': {
    summary: m.zpl_help_draws_a_diagonal_line_across_a_box_of_the_given__249(),
    parameters: [
      {
        name: m.zpl_help_width_250(),
        describe: (value, context) =>
          m.zpl_help_value0_wide_251({ value0: String(dots(value, context)) }),
      },
      {
        name: m.zpl_help_height_252(),
        describe: (value, context) =>
          m.zpl_help_value0_tall_253({ value0: String(dots(value, context)) }),
      },
      SHAPE_THICKNESS,
      SHAPE_COLOUR,
      {
        name: m.zpl_help_direction_254(),
        describe: choice({
          R: m.zpl_help_leans_right_like_255(),
          '/': m.zpl_help_leans_right_like_256(),
          L: m.zpl_help_leans_left_like_257(),
          '\\': m.zpl_help_leans_left_like_258(),
        }),
        fallback: m.zpl_help_leans_right_like_259(),
      },
    ],
  },
  '^GF': {
    summary: m.zpl_help_draws_a_picture_written_out_dot_by_dot_in_the_co_260(),
    parameters: [
      {
        name: m.zpl_help_format_261(),
        describe: choice({
          A: m.zpl_help_hex_text_262(),
          B: m.zpl_help_binary_263(),
          C: m.zpl_help_compressed_binary_264(),
        }),
      },
      {
        name: m.zpl_help_data_size_265(),
        describe: (value) =>
          m.zpl_help_value0_bytes_266({ value0: String(value) }),
      },
      {
        name: m.zpl_help_total_size_267(),
        describe: (value) =>
          m.zpl_help_value0_bytes_268({ value0: String(value) }),
      },
      {
        name: m.zpl_help_bytes_per_row_269(),
        describe: (value) =>
          m.zpl_help_value0_bytes_so_value1_dots_wide_270({
            value0: String(value),
            value1: String(Number(value) * 8),
          }),
      },
      {
        name: m.zpl_help_image_data_271(),
        describe: () => m.zpl_help_the_picture_itself_272(),
      },
    ],
  },
  '^XG': {
    summary: m.zpl_help_draws_an_image_saved_on_the_printer_earlier_273(),
    parameters: [
      {
        name: m.zpl_help_image_274(),
        describe: (value) =>
          m.zpl_help_the_image_named_value0_275({ value0: String(value) }),
      },
      { name: m.zpl_help_x_scale_276(), fallback: '1' },
      { name: m.zpl_help_y_scale_277(), fallback: '1' },
    ],
  },

  // Barcodes
  '^BY': {
    summary: m.zpl_help_sets_the_default_bar_size_for_barcodes_after_it__278(),
    parameters: [
      {
        name: m.zpl_help_bar_width_279(),
        describe: (value, context) =>
          m.zpl_help_narrowest_bar_is_value0_280({
            value0: String(dots(value, context)),
          }),
        fallback: m.zpl_help_2_dots_281(),
      },
      {
        name: m.zpl_help_ratio_282(),
        describe: (value) =>
          m.zpl_help_wide_bars_are_value0_the_narrow_ones_283({
            value0: String(value),
          }),
        fallback: '3',
      },
      {
        name: m.zpl_help_height_284(),
        describe: (value, context) =>
          m.zpl_help_value0_tall_285({ value0: String(dots(value, context)) }),
        fallback: m.zpl_help_10_dots_286(),
      },
    ],
    hint: ([width = '2', , height]) =>
      m.zpl_help_barcodes_below_bars_value0_dots_wide_value1_287({
        value0: String(width),
        value1: String(height ? m.zpl_help_bar_height({ height }) : ''),
      }),
  },
  '^BC': {
    summary: m.zpl_help_draws_a_code_128_barcode_the_most_common_shippin_288(),
    parameters: [
      ...LINEAR_BARCODE,
      { ...CHECK_DIGIT, name: m.zpl_help_ucc_check_digit_289() },
      {
        name: m.zpl_help_mode_290(),
        describe: choice({
          N: m.zpl_help_normal_291(),
          U: m.zpl_help_ucc_case_mode_292(),
          A: m.zpl_help_automatic_293(),
          D: 'GS1 / UCC/EAN',
        }),
        fallback: m.zpl_help_normal_294(),
      },
    ],
  },
  '^B3': {
    summary: m.zpl_help_draws_a_code_39_barcode_the_fd_after_it_holds_th_295(),
    parameters: [
      BARCODE_ORIENTATION,
      CHECK_DIGIT,
      BARCODE_HEIGHT,
      HUMAN_READABLE,
      TEXT_ABOVE,
    ],
  },
  '^BE': {
    summary: m.zpl_help_draws_an_ean_13_barcode_used_on_retail_products__296(),
    parameters: LINEAR_BARCODE,
  },
  '^BU': {
    summary: m.zpl_help_draws_a_upc_a_barcode_used_on_retail_products_th_297(),
    parameters: [...LINEAR_BARCODE, CHECK_DIGIT],
  },
  '^B8': {
    summary: m.zpl_help_draws_an_ean_8_barcode_the_fd_after_it_holds_the_298(),
    parameters: LINEAR_BARCODE,
  },
  '^B9': {
    summary: m.zpl_help_draws_a_upc_e_barcode_the_fd_after_it_holds_the__299(),
    parameters: [...LINEAR_BARCODE, CHECK_DIGIT],
  },
  '^B2': {
    summary: m.zpl_help_draws_an_interleaved_2_of_5_barcode_for_digits_o_300(),
    parameters: [...LINEAR_BARCODE, CHECK_DIGIT],
  },
  '^BA': {
    summary: m.zpl_help_draws_a_code_93_barcode_the_fd_after_it_holds_th_301(),
    parameters: [...LINEAR_BARCODE, CHECK_DIGIT],
  },
  '^BQ': {
    summary: m.zpl_help_draws_a_qr_code_in_the_fd_after_it_the_first_let_302(),
    parameters: [
      {
        name: m.zpl_help_orientation_303(),
        describe: () => m.zpl_help_always_normal_304(),
      },
      {
        name: m.zpl_help_model_305(),
        describe: choice({
          '1': m.zpl_help_original_model_306(),
          '2': m.zpl_help_enhanced_model_307(),
        }),
        fallback: m.zpl_help_enhanced_model_2_308(),
      },
      {
        name: m.zpl_help_size_309(),
        describe: (value) =>
          m.zpl_help_each_square_is_value0_dots_310({ value0: String(value) }),
        fallback: m.zpl_help_depends_on_the_printer_311(),
      },
      {
        name: m.zpl_help_error_correction_312(),
        describe: choice({
          H: m.zpl_help_highest_still_scans_when_30_is_damaged_313(),
          Q: m.zpl_help_high_25_314(),
          M: m.zpl_help_standard_15_315(),
          L: m.zpl_help_lowest_7_316(),
        }),
        fallback: m.zpl_help_set_by_the_fd_prefix_317(),
      },
      {
        name: m.zpl_help_mask_318(),
        fallback: m.zpl_help_chosen_automatically_319(),
      },
    ],
  },
  '^BX': {
    summary: m.zpl_help_draws_a_data_matrix_code_a_small_square_2d_code__320(),
    parameters: [
      BARCODE_ORIENTATION,
      {
        name: m.zpl_help_square_size_321(),
        describe: (value, context) =>
          m.zpl_help_each_square_is_value0_322({
            value0: String(dots(value, context)),
          }),
      },
      {
        name: m.zpl_help_quality_323(),
        describe: (value) =>
          value === '200' ? m.zpl_help_ecc_200_the_standard_324() : value,
        fallback: 'ECC 0',
      },
      {
        name: m.zpl_help_columns_325(),
        fallback: m.zpl_help_chosen_automatically_326(),
      },
      {
        name: m.zpl_help_rows_327(),
        fallback: m.zpl_help_chosen_automatically_328(),
      },
    ],
  },
  '^B7': {
    summary: m.zpl_help_draws_a_pdf417_code_a_stacked_2d_barcode_often_u_329(),
    parameters: [
      BARCODE_ORIENTATION,
      {
        name: m.zpl_help_row_height_330(),
        describe: (value, context) =>
          m.zpl_help_each_row_is_value0_tall_331({
            value0: String(dots(value, context)),
          }),
      },
      {
        name: m.zpl_help_security_level_332(),
        fallback: m.zpl_help_chosen_automatically_333(),
      },
      {
        name: m.zpl_help_columns_334(),
        fallback: m.zpl_help_chosen_automatically_335(),
      },
      {
        name: m.zpl_help_rows_336(),
        fallback: m.zpl_help_chosen_automatically_337(),
      },
      {
        name: m.zpl_help_truncate_338(),
        describe: yesNo(
          m.zpl_help_shortened_right_edge_339(),
          m.zpl_help_full_width_340(),
        ),
        fallback: m.zpl_help_full_width_341(),
      },
    ],
  },

  // Stored things
  '~DG': {
    summary: m.zpl_help_saves_an_image_in_the_printer_s_memory_to_draw_l_342(),
  },
  '^DF': {
    summary: m.zpl_help_saves_this_label_as_a_template_in_the_printer_to_343(),
  },
  '^XF': {
    summary: m.zpl_help_loads_a_label_template_saved_earlier_with_df_344(),
  },
  '~JA': {
    summary: m.zpl_help_cancels_every_label_waiting_to_print_345(),
  },
}

const CATEGORY_SUMMARIES: Partial<
  Record<CommandCapability['category'], string>
> = {
  text: m.zpl_help_changes_how_text_looks_346(),
  graphic: m.zpl_help_draws_a_shape_or_picture_347(),
  storage: m.zpl_help_saves_or_loads_something_kept_in_the_printer_s_m_348(),
  format: m.zpl_help_changes_how_the_rest_of_the_label_is_laid_out_349(),
}

const PRINTER_SUMMARY =
  m.zpl_help_a_printer_setting_it_changes_how_the_printer_beh_350()

// Lookup ---------------------------------------------------------------------

function capabilityOf(command: Pick<ZplCommandNode, 'canonical'>) {
  return getCommandCapability(command.canonical)
}

function nameOf(canonical: string, capability: CommandCapability | undefined) {
  const guide = GUIDES[canonical]
  if (guide?.name) return guide.name
  // zplr names commands it only recognises after themselves.
  if (capability && !capability.name.startsWith('Recognized')) {
    return capability.name
  }
  return null
}

/** Barcode names read better without zplr's trailing "Bar Code". */
function barcodeName(name: string) {
  const short = name.replace(/ Bar Code$/, '')
  return /code$/i.test(short)
    ? short
    : m.zpl_help_value0_barcode_351({ value0: String(short) })
}

function valuesOf(command: Pick<ZplCommandNode, 'code' | 'parameters'>): {
  values: Values
  rawIndexes: number[]
} {
  const trimmed = command.parameters.map((value) => value.trim())
  if (command.code === 'A') {
    // ^A0N,30,30: the font name and orientation share the first value.
    const [first = '', ...rest] = trimmed
    return {
      values: [
        first.slice(0, 1) || undefined,
        first.slice(1) || undefined,
        ...rest,
      ],
      rawIndexes: [0, 0, ...rest.map((_, index) => index + 1)],
    }
  }
  return { values: trimmed, rawIndexes: trimmed.map((_, index) => index) }
}

export function explainCommand(
  command: Pick<
    ZplCommandNode,
    'canonical' | 'code' | 'parameters' | 'rawParameters'
  >,
  context: ExplainContext,
): CommandExplanation {
  const capability = capabilityOf(command)
  const guide = GUIDES[command.canonical]
  const name = nameOf(command.canonical, capability) ?? m.zpl_help_unknown()

  let summary = guide?.summary
  if (!summary && capability) {
    summary =
      capability.category === 'barcode'
        ? m.zpl_help_draws_a_value0_the_fd_after_it_holds_the_content_352({
            value0: String(barcodeName(capability.name)),
          })
        : capability.status === 'non-rendering' ||
            capability.effect === 'device'
          ? PRINTER_SUMMARY
          : (CATEGORY_SUMMARIES[capability.category] ?? PRINTER_SUMMARY)
  }
  summary ??= m.zpl_help_unknown_detail()

  const parameters: ParameterExplanation[] = []
  if (guide?.raw) {
    const value = command.rawParameters.trim()
    parameters.push({
      name: guide.raw,
      value: value || null,
      meaning: value ? `“${value}”` : m.zpl_help_empty_353(),
      rawIndex: 0,
    })
  } else {
    const { values, rawIndexes } = valuesOf(command)
    guide?.parameters?.forEach((parameter, index) => {
      const value = values[index]
      const given = value !== undefined && value !== ''
      parameters.push({
        name: parameter.name,
        value: given ? value : null,
        meaning: given
          ? (parameter.describe?.(value, context) ?? value)
          : (parameter.fallback ?? m.zpl_help_default()),
        rawIndex: rawIndexes[index] ?? index,
      })
    })
  }

  return { canonical: command.canonical, name, summary, parameters, capability }
}

/** Which comma-separated value of `command` the source offset falls in. */
export function parameterIndexAt(
  command: Pick<ZplCommandNode, 'span' | 'rawParameters' | 'delimiter'>,
  offset: number,
): number | null {
  const rawStart = command.span.end - command.rawParameters.length
  if (offset < rawStart) return null
  const before = command.rawParameters.slice(0, offset - rawStart)
  return before.split(command.delimiter).length - 1
}

// Line hints -----------------------------------------------------------------

/** Commands that build up one field between ^FO/^FT and ^FS. */
const FIELD_COMMANDS = new Set([
  'FO',
  'FT',
  'A',
  'A@',
  'FD',
  'FV',
  'FR',
  'FB',
  'FH',
  'FN',
  'FS',
  'TB',
])

interface Field {
  start: number
  x?: string
  y?: string
  fontHeight?: string
  orientation?: string
  data?: string
  reverse: boolean
  blockWidth?: string
  slot?: string
  /** What the field draws when it isn't plain text. */
  drawing?: ZplCommandNode
}

interface LabelState {
  fontHeight?: string
  orientation?: string
  barcodeHeight?: string
}

const BARCODE_HEIGHT_INDEX: Partial<Record<string, number>> = {
  BC: 1,
  B3: 2,
  BE: 1,
  BU: 1,
  B8: 1,
  B9: 1,
  B2: 1,
  BA: 1,
}

function quote(value: string, max = 32) {
  const text = value.replace(/\s+/g, ' ').trim()
  return `“${text.length > max ? `${text.slice(0, max - 1)}…` : text}”`
}

function valueAt(command: ZplCommandNode, index: number) {
  const raw = command.parameters[index]?.trim()
  return raw === '' ? undefined : raw
}

function describeDrawing(
  drawing: ZplCommandNode,
  field: Field,
  label: LabelState,
) {
  const number = (index: number, fallback: number) => {
    const parsed = Number(valueAt(drawing, index))
    return Number.isFinite(parsed) && valueAt(drawing, index) !== undefined
      ? parsed
      : fallback
  }

  switch (drawing.code) {
    case 'GB': {
      const thickness = number(2, 1)
      const width = Math.max(number(0, thickness), thickness)
      const height = Math.max(number(1, thickness), thickness)
      const filled = thickness * 2 >= Math.min(width, height)
      // A filled box much longer than it is thick reads as a line.
      const shape =
        filled && height * 10 <= width
          ? m.zpl_help_horizontal_line_value0_dots_long_354({
              value0: String(width),
            })
          : filled && width * 10 <= height
            ? m.zpl_help_vertical_line_value0_dots_long_355({
                value0: String(height),
              })
            : filled
              ? m.zpl_help_solid_box_value0_value1_dots_356({
                  value0: String(width),
                  value1: String(height),
                })
              : m.zpl_help_box_outline_value0_value1_dots_357({
                  value0: String(width),
                  value1: String(height),
                })
      const white = valueAt(drawing, 3)?.toUpperCase() === 'W'
      return white
        ? m.zpl_help_white_value0_358({ value0: String(shape) })
        : shape.charAt(0).toUpperCase() + shape.slice(1)
    }
    case 'GC':
      return m.zpl_help_circle_value0_dots_across_359({
        value0: String(number(0, 3)),
      })
    case 'GE':
      return m.zpl_help_ellipse_value0_value1_dots_360({
        value0: String(number(0, 3)),
        value1: String(number(1, 3)),
      })
    case 'GD':
      return m.zpl_help_diagonal_line_across_value0_value1_dots_361({
        value0: String(number(0, 3)),
        value1: String(number(1, 3)),
      })
    case 'GF': {
      const total = number(2, 0)
      const perRow = number(3, 0)
      return perRow > 0
        ? m.zpl_help_picture_value0_value1_dots_362({
            value0: String(perRow * 8),
            value1: String(Math.round(total / perRow)),
          })
        : m.zpl_help_picture_363()
    }
    case 'XG':
      return m
        .zpl_help_saved_image_value0_364({
          value0: String(valueAt(drawing, 0) ?? ''),
        })
        .trim()
    case 'GS':
      return m.zpl_help_symbol_365()
  }

  const capability = capabilityOf(drawing)
  if (capability?.category !== 'barcode')
    return capability?.name ?? m.zpl_help_item()

  const kind = barcodeName(capability.name)
  let content = field.data
  if (drawing.code === 'BQ' && content) {
    // QR data starts with its error correction and input mode, like "QA,".
    content = content.replace(/^[HQML]?[AM],/i, '')
  }
  const heightIndex = BARCODE_HEIGHT_INDEX[drawing.code]
  const height =
    heightIndex === undefined
      ? undefined
      : (valueAt(drawing, heightIndex) ?? label.barcodeHeight)
  return [
    content ? `${kind} ${quote(content)}` : kind,
    height ? m.zpl_help_value0_dots_tall_366({ value0: String(height) }) : null,
  ]
    .filter(Boolean)
    .join(', ')
}

function describeField(field: Field, label: LabelState) {
  const parts: string[] = []
  if (field.drawing) {
    parts.push(describeDrawing(field.drawing, field, label))
  } else if (field.data !== undefined) {
    parts.push(
      m.zpl_help_text_value0_367({ value0: String(quote(field.data)) }),
    )
    const height = field.fontHeight ?? label.fontHeight
    if (height)
      parts.push(m.zpl_help_value0_dots_tall_368({ value0: String(height) }))
    if (field.blockWidth)
      parts.push(
        m.zpl_help_wrapped_to_value0_dots_wide_369({
          value0: String(field.blockWidth),
        }),
      )
  } else if (field.slot) {
    parts.push(
      m.zpl_help_fill_in_slot_value0_370({ value0: String(field.slot) }),
    )
  } else {
    return null
  }

  const turn = (field.orientation ?? label.orientation)?.toUpperCase()
  if (turn && turn !== 'N' && ORIENTATIONS[turn]) parts.push(ORIENTATIONS[turn])
  if (field.reverse) parts.push(m.zpl_help_printed_inverted_371())
  parts.push(
    m.zpl_help_at_value0_value1_372({
      value0: String(field.x ?? 0),
      value1: String(field.y ?? 0),
    }),
  )
  return parts.join(', ')
}

function standaloneHint(command: ZplCommandNode, context: ExplainContext) {
  const guide = GUIDES[command.canonical]
  if (guide?.hint) return guide.hint(valuesOf(command).values, context)
  if (guide?.raw) return null
  return nameOf(command.canonical, capabilityOf(command))
}

/**
 * One plain-language line per field (text, barcode, box…) and per setting,
 * at the offset where it starts in the source.
 */
export function explainDocument(
  document: Pick<ZplDocument, 'items'>,
  context: ExplainContext,
): ExplainHint[] {
  const hints: ExplainHint[] = []
  const push = (offset: number, text: string | null) => {
    if (text) hints.push({ offset, text })
  }

  for (const item of document.items) {
    if (item.kind === 'command') {
      push(item.span.start, standaloneHint(item, context))
      continue
    }

    const label: LabelState = {}
    let field: Field | null = null
    const startField = (command: ZplCommandNode) =>
      (field ??= { start: command.span.start, reverse: false })

    for (const command of item.commands) {
      const { code } = command
      const capability = capabilityOf(command)
      const draws =
        capability?.category === 'barcode' && code !== 'BY'
          ? true
          : ['GB', 'GC', 'GE', 'GD', 'GF', 'GS', 'XG'].includes(code)

      if (!FIELD_COMMANDS.has(code) && !draws) {
        if (code === 'CF')
          label.fontHeight = valueAt(command, 1) ?? label.fontHeight
        if (code === 'FW')
          label.orientation = valueAt(command, 0) ?? label.orientation
        if (code === 'BY')
          label.barcodeHeight = valueAt(command, 2) ?? label.barcodeHeight
        push(command.span.start, standaloneHint(command, context))
        continue
      }

      const current = startField(command)
      switch (code) {
        case 'FO':
        case 'FT':
          current.x = valueAt(command, 0)
          current.y = valueAt(command, 1)
          break
        case 'A':
        case 'A@': {
          const { values } = valuesOf(command)
          const offset = code === 'A' ? 1 : 0
          current.orientation = values[offset] ?? current.orientation
          current.fontHeight = values[offset + 1] ?? current.fontHeight
          break
        }
        case 'FD':
        case 'FV':
          current.data = command.rawParameters
          break
        case 'FR':
          current.reverse = true
          break
        case 'FB':
        case 'TB':
          current.blockWidth = valueAt(command, code === 'TB' ? 1 : 0)
          break
        case 'FN':
          current.slot = valueAt(command, 0)
          break
        case 'FS':
          push(current.start, describeField(current, label))
          field = null
          break
        default:
          current.drawing = command
      }
    }

    // A label can end without closing its last field.
    const unfinished = field as Field | null
    if (unfinished) push(unfinished.start, describeField(unfinished, label))
  }

  return hints.sort((a, b) => a.offset - b.offset)
}
