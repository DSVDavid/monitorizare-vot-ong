import { filter, takeUntil } from 'rxjs/operators';
import { Component, OnDestroy, OnInit, ɵɵsetComponentScope } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Form } from '../../../models/form.model';
import { Location } from '@angular/common';
import { FormSection } from '../../../models/form.section.model';
import { AppState } from '../../../store/store.module';
import { Store } from '@ngrx/store';
import { FormActionTypes, FormUploadAction, FormUploadCompleteAction, FormUploadPublishAction, FullyLoadFormAction } from '../../../store/form/form.actions';
import { Subject, Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { moveItemInFormArray } from '../../utils';
import { initFormFormGroup, initOptionFormGroup, initQuestionFormGroup, initSectionFormGroup } from '../form-groups-builder';
import { FormQuestion } from '../../../models/form.question.model';
import { BaseAnswer } from '../../../models/base.answer.model';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmationModalComponent } from 'src/app/shared/confirmation-modal/confirmation-modal.component';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { FormEffects } from 'src/app/store/form/form.effects';

@Component({
  selector: 'app-form-create',
  templateUrl: './form-create.component.html',
  styleUrls: ['./form-create.component.scss']
})
export class FormCreateComponent implements OnInit, OnDestroy {

  readonly FORM_ID_URL_PARAM = 'formId';
  title: string;
  formDetailsFormGroup: FormGroup;
  private destroy$: Subject<boolean> = new Subject<boolean>();


  constructor(private location: Location,
    private store: Store<AppState>,
    private FormEffects$: FormEffects,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private formBuilder: FormBuilder,
    private _modalService: NgbModal) { }

  ngOnInit() {
    this.formDetailsFormGroup = initFormFormGroup(this.formBuilder);
    this.title = 'Adauga formular nou';
    this.listenToActionSteam();

    this.activatedRoute.paramMap.subscribe(params => {
      const hasFormId = params.has(this.FORM_ID_URL_PARAM);
      if (!hasFormId) {
        return;
      }

      const targetFormId = +params.get(this.FORM_ID_URL_PARAM);
      this.loadFormForEditing(targetFormId);
      this.handleLoadedFormData(targetFormId);
    });
  }

  get sectionsArray() {
    return this.formDetailsFormGroup.get('formSections') as FormArray;
  }

  get sectionFormGroupsArray(): FormGroup[] {
    return this.sectionsArray.controls as FormGroup[];
  }

  private initSectionFormGroupWithValues(formSection: FormSection) {
    return this.initFormGroupWithValues(initSectionFormGroup, formSection);
  }

  private initQuestionFormGroupWithValues(formQuestion: FormQuestion) {
    return this.initFormGroupWithValues(initQuestionFormGroup, formQuestion);
  }

  private initOptionFormGroupWithValues(formOption: BaseAnswer) {
    return this.initFormGroupWithValues(initOptionFormGroup, formOption);
  }

  private initFormGroupWithValues(formGroupGenerator: (formBuilder: FormBuilder) => FormGroup, value: any) {
    const formGroup = formGroupGenerator(this.formBuilder);
    formGroup.patchValue(value);
    return formGroup;
  }

  private loadFormForEditing(formId: number) {
    this.store.dispatch(new FullyLoadFormAction(formId));
  }

  private handleLoadedFormData(formId: number) {
    this.store
      .select(state => state.form.fullyLoaded)
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(loadedForms => {
        const correspondingForm = loadedForms[formId];
        if (!correspondingForm) {
          return;
        }

        this.patchReactiveForm(correspondingForm);
      });
  }

  private patchReactiveForm(form: Form) {
    this.formDetailsFormGroup.patchValue(form);
    form.formSections.forEach(s => {
      const sectionFormGroup = this.initSectionFormGroupWithValues(s);
      s.questions.forEach(q => {
        const questionFormGroup = this.initQuestionFormGroupWithValues(q);

        q.optionsToQuestions.forEach(o => {
          const optionFormGroup = this.initOptionFormGroupWithValues(o);

          const optionsArray = questionFormGroup.controls.optionsToQuestions as FormArray;
          optionsArray.push(optionFormGroup);
        });

        const questionsArray = sectionFormGroup.controls.questions as FormArray;
        questionsArray.push(questionFormGroup);
      });
      this.sectionsArray.push(sectionFormGroup);
    });
  }

  public onBackPressed() {
    this.location.back();
  }

  addFormSection() {
    this.sectionsArray.push(initSectionFormGroup(this.formBuilder));
  }

  saveForm() {
    const form = this.formDetailsFormGroup.value as Form;
    this.store.dispatch(new FormUploadAction(form));
  }

  saveAndPublishForm() {
    const form = this.formDetailsFormGroup.value as Form;
    this.store.dispatch(new FormUploadPublishAction(form));
  }

  private listenToActionSteam(): void {
    this.FormEffects$.formUpload.pipe(
      filter(action => action.type === FormActionTypes.UPLOAD_COMPLETE),
      takeUntil(this.destroy$)
    ).subscribe(res => {
      if (res.type === new FormUploadCompleteAction().type) {
        this.routeBackToList();
      }
    });
    this.FormEffects$.formUploadPublish.pipe(
      filter(action => action.type === FormActionTypes.UPLOAD_COMPLETE),
      takeUntil(this.destroy$)
    ).subscribe(res => {
      if (res.type === new FormUploadCompleteAction().type) {
        this.routeBackToList();
      }
    });
  }

  private routeBackToList(): void {
    this.router.navigate(['../'], { relativeTo: this.activatedRoute });
  }

  onSectionDelete(index: number) {
    const modalRef = this._modalService.open(ConfirmationModalComponent)
    modalRef.componentInstance.message = 'Are you sure you want to delete this record?';
    modalRef.result.then(() => this.sectionsArray.removeAt(index))
      .catch(() => { });
  }

  ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.unsubscribe();
  }

  onReorder(event: CdkDragDrop<FormSection[]>) {
    moveItemInFormArray(this.sectionsArray, event.previousIndex, event.currentIndex);
  }
}
