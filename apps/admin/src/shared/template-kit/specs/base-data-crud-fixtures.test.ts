import { describe, expect, it } from '@rstest/core'
import { CAMPUS_CRUD_SPEC, GRADE_CRUD_SPEC } from './base-data-crud-fixtures'
import { validateBaseDataCrudSpec } from './base-data-crud-spec'

describe('base-data crud spec fixtures', () => {
  it('grade fixture passes validation and keeps required constraints', () => {
    expect(validateBaseDataCrudSpec(GRADE_CRUD_SPEC)).toEqual([])
    expect(GRADE_CRUD_SPEC.constraints.noDrawerEdit).toBe(true)
    expect(GRADE_CRUD_SPEC.constraints.readonlyFormReuse).toBe(true)
    expect(GRADE_CRUD_SPEC.uiInteractionConstraints.forbidUndeclaredUi).toBe(true)
    expect(GRADE_CRUD_SPEC.uiInteractionConstraints.templateConflictPolicy).toBe('template-first')
    expect(GRADE_CRUD_SPEC.apis.list).toContain('GET /api/v1/grades')
    expect(GRADE_CRUD_SPEC.formRoute).toBe('/dev/base-data/grade/form')
  })

  it('campus fixture passes validation and keeps required constraints', () => {
    expect(validateBaseDataCrudSpec(CAMPUS_CRUD_SPEC)).toEqual([])
    expect(CAMPUS_CRUD_SPEC.constraints.noDrawerEdit).toBe(true)
    expect(CAMPUS_CRUD_SPEC.constraints.readonlyFormReuse).toBe(true)
    expect(CAMPUS_CRUD_SPEC.uiInteractionConstraints.forbidUndeclaredUi).toBe(true)
    expect(CAMPUS_CRUD_SPEC.uiInteractionConstraints.templateConflictPolicy).toBe('template-first')
    expect(CAMPUS_CRUD_SPEC.apis.list).toContain('GET /api/v1/campuses')
    expect(CAMPUS_CRUD_SPEC.formRoute).toBe('/base-data/campuses/form')
  })
})
