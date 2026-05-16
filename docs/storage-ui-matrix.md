# Storage UI Matrix

BaseBuddy chooses editor controls from storage shape first. Semantic roles refine copy and behavior, but they do not override the storage contract.

Formula:

```text
rendered control = storage primitive + value kind + semantic role
```

## Storage Primitives

| Primitive | Meaning | Patch mode | UI behavior |
| --- | --- | --- | --- |
| `direct_column` | Whole value lives in one column | `replace` | Render the control for the value kind |
| `json_path` | Value lives at a path inside `json` or `jsonb` | `key_patch` | Patch only the selected JSON path |
| `array_value` | Whole column is a list | `replace` | Render a repeatable/token control |
| `array_item` | One mapped field writes one array index | `index_patch` | Render one control for that element |
| `foreign_key` | Column points at a related row | `link_replace` | Render a single relation selector |
| `related_row_by_post_id` | Helper row keyed by post id stores a value | `link_replace` | Render scalar control, write through helper row |
| `join_row` | Single helper row stores a scalar value | `link_replace` | Render scalar control, write through helper row |
| `join_table` | Many rows encode many selected values | `link_replace` | Render multi relation selector |
| `polymorphic_join` | Relation uses a discriminator | `link_replace` | Editable only when the discriminator contract is explicit |
| `value_match_relation` | Stored value matches target-side value | `link_replace` | Render relation selector backed by target value |
| `enum_mapping` | Workflow/status enum mapping | `replace` | Render dropdown when editable |
| `boolean_mapping` | Workflow/status boolean mapping | `replace` | Render toggle when editable |
| `derived_read_only` | Computed, generated, view-derived, or unsafe | `no_write` | Render read-only |

## Value Kinds And Controls

| Value kind | Default control |
| --- | --- |
| `text_like`, `text_like_inline` | text input |
| `long_text` | textarea |
| `content` | rich content editor |
| `number` | number input |
| `boolean` | toggle |
| `enum` | dropdown |
| `date` | date picker |
| `datetime`, `date_or_datetime` | datetime picker |
| `json_object`, `json_object_inline`, `json_object_list` | structured editor |
| `array_scalar`, `array_scalar_inline` | token input |
| `text_like_list`, `number_list`, `boolean_list`, `enum_list` | token input |
| `relation_id_or_key` | single or multi select |
| `redirects` | redirect rows editor or list editor |
| `binary_or_exotic` | read-only |

## Editability States

| State | Meaning |
| --- | --- |
| `editable` | BaseBuddy can write the mapped storage target directly |
| `coercible` | BaseBuddy can write after a controlled conversion, such as a publish timestamp |
| `read_only` | The value can be displayed but not written |
| `unsupported` | The mapping is incomplete or unsafe for this field |

## Common Postgres Shapes

| Postgres shape | Typical BaseBuddy treatment |
| --- | --- |
| `text`, `varchar`, `char` | text input or textarea depending on field kind |
| `integer`, `smallint`, `real`, `double precision` | number input |
| `numeric`, `decimal`, `bigint` | number or text-preserving numeric handling when precision matters |
| `boolean` | toggle |
| enum | dropdown |
| `date` | date picker |
| `timestamp`, `timestamptz`, `time` | datetime picker |
| `json`, `jsonb` | structured editor or path patch |
| arrays | token input or array-item control |
| range types | range input for custom fields |
| multirange types | multirange editor for custom fields |
| XML | structured/code editor for custom fields |
| generated/view/trigger-managed values | read-only |
| system, WAL, cursor, ACL, unknown composite, unsafe polymorphic shapes | read-only or unsupported |

## Relation Modes

| Relation mode | Behavior |
| --- | --- |
| `managed_single` | searchable single relation selector |
| `managed_multi` | searchable multi relation selector |
| `value_match_single` | single selector where stored value matches a target value |
| `value_match_multi` | multi selector where stored values match target values |
| `inline` | displayed through mapped fields, generally read-only |
| `none` | no relation behavior |

Relation selectors search remotely. They should not require loading every possible related row into the browser.
