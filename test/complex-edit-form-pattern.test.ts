import { combineLatest, merge, NEVER, Observable, of } from 'rxjs';
import {
  catchError,
  delay,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  withLatestFrom
} from 'rxjs/operators';
import { Store, TypeIdentifier } from './../src/store';
import { expectSequence } from './test.utils';
describe('Edit From Pattern', () => {
  // This integration test is an example for a simple setup to
  // - load
  // - edit
  // - validate
  // - persist
  // an entity.
  //
  // It has the following non-lazy behaviors:
  // - showEditModal: boolean state
  // - editModelState: represents the state of the model that is updated by events from the edit form
  // - validationState: represents a model and its validation result (not necessarily the current model)
  // - saveRequestState: null or the model to be handled by the SaveEffect
  // - errorState: holds errors thrown by any effects
  // Lazy behaviors (derived state):
  // - isValidationPending: boolean (true, if editModelState.model !== validationState.model)
  // - isSaveDisabled: boolean (true, if isValidationPending || !validationState.valid || isSavePending)
  // - isSavePending: boolean (true, if saveRequestState !== null)
  // Events:
  // - startEditEvent: null for creating a new entity, else the ID of the entity to be edited
  // - editModelEvent: the result of the editModelEffect and also signals to the show edit modal state
  // - validationEvent: the result of the validationEffect
  // - saveEvent: sets the saveRequestState
  // - savedEvent: signals whether save was a success and the id of the saved entity and is also handled by the show edit modal state
  // - addErrorEvent:
  // - clearErrorsEvent:
  // Effects:
  // - editModelEffect: listens to the startEditEvent and dispatches a new entity template or a fetched entity
  // - validationEffect: validation is designed as effect, to account for async validation logic (e.g. against a backend)
  // - saveEffect: persists the model from the saveRequestState, in case it is the validated model

  // Defining a simple entity type for an entity to be edited
  interface Entity {
    id: number | null;
    stringField: string | null;
    numberField: number | null;
  }
  const getNewEntity = () => ({ id: null, stringField: null, numberField: null });

  interface EditModel {
    model: Entity;
  }

  interface ValidationResult {
    validatedValue: any;
    error: string;
  }

  interface ValidationState {
    model: Entity | null;
    valid: boolean;
    validationResults: { [key: string]: ValidationResult };
  }

  const showEditModalState: TypeIdentifier<boolean> = { symbol: Symbol('ShowEditModalState') };
  const editModelState: TypeIdentifier<EditModel> = { symbol: Symbol('EditModelState') };
  const validationState: TypeIdentifier<ValidationState> = { symbol: Symbol('ValidationState') };
  const saveRequestState: TypeIdentifier<Entity | null> = { symbol: Symbol('SaveRequestState') };
  const errorState: TypeIdentifier<string[]> = { symbol: Symbol('ErrorState') };

  const isValidationPending: TypeIdentifier<boolean> = {
    symbol: Symbol('IsValidationPendingBehavior'),
  };
  const isSaveDisabled: TypeIdentifier<boolean> = { symbol: Symbol('IsSaveDisabledBehavior') };
  const isSavePending: TypeIdentifier<boolean> = { symbol: Symbol('IsSavePendingBehavior') };

  const startEditEvent: TypeIdentifier<number | null> = { symbol: Symbol('StartEditEvent') };
  const editModelEvent: TypeIdentifier<Entity> = { symbol: Symbol('EditModelEvent') };
  const updateEvent: TypeIdentifier<Partial<Entity>> = { symbol: Symbol('UpdateEvent') };
  const validationEvent: TypeIdentifier<ValidationState> = { symbol: Symbol('ValidationEvent') };
  const saveEvent: TypeIdentifier<void> = { symbol: Symbol('SaveEvent') };
  const savedEvent: TypeIdentifier<{ requestModel: Entity; id: number; success: boolean }> = {
    symbol: Symbol('SavedEvent'),
  };
  const addErrorEvent: TypeIdentifier<string> = { symbol: Symbol('AddErrorEvent') };
  const clearErrorsEvent: TypeIdentifier<void> = { symbol: Symbol('ClearErrorsEvent') };

  const editModelEffect = Symbol('EditModelEffect');
  const validationEffect = Symbol('ValidationEffect');
  const saveEffect = Symbol('SaveEffect');

  let store: Store;
  let testObservable: Observable<{
    showEditModalState: boolean;
    editModelState: EditModel;
    validationState: ValidationState;
    saveRequestState: Entity | null;
    errorState: string[];
    isSaveDisabled: boolean;
    isSavePending: boolean;
    isValidationPending: boolean;
  }>;

  beforeEach((): void => {
    store = new Store();

    // Setup test observable (combined states for sequence tests):
    testObservable = combineLatest([
      combineLatest([
        store.getBehavior(showEditModalState),
        store.getBehavior(editModelState),
        store.getBehavior(validationState),
        store.getBehavior(saveRequestState),
        store.getBehavior(errorState),
      ]),
      combineLatest([
        store.getBehavior(isSaveDisabled),
        store.getBehavior(isSavePending),
        store.getBehavior(isValidationPending),
      ]),
    ]).pipe(
      map(
        ([
          [showEditModalState, editModelState, validationState, saveRequestState, errorState],
          [isSaveDisabled, isSavePending, isValidationPending],
        ]) => ({
          showEditModalState,
          editModelState,
          validationState,
          saveRequestState,
          errorState,
          isSaveDisabled,
          isSavePending,
          isValidationPending,
        }),
      ),
    );

    // Setup the show edit modal state:
    store.addNonLazyBehavior(
      showEditModalState,
      merge(
        store.getTypedEventStream(editModelEvent),
        store.getTypedEventStream(savedEvent).pipe(
          filter(event => event.event.success),
          withLatestFrom(store.getBehavior(saveRequestState)),
          filter(([event, requestState]) => event.event.requestModel === requestState),
          map(([event]) => event),
        ),
      ).pipe(map(event => (event.type === editModelEvent ? true : false))),
      false,
    );

    // Setup the edit model state:
    store.addState(editModelState, {
      model: getNewEntity(),
    });
    store.addReducer(editModelState, updateEvent, (state, event) => ({
      ...state,
      model: {
        ...state.model,
        ...event,
      },
    }));

    // Setup the save request state:
    store.addNonLazyBehavior(
      saveRequestState,
      merge(store.getTypedEventStream(saveEvent), store.getTypedEventStream(savedEvent)).pipe(
        withLatestFrom(store.getBehavior(editModelState)),
        map(([event, editModel]) => (event.type === saveEvent ? editModel.model : null)),
      ),
      null,
    );

    // Setup the validation state:
    store.addNonLazyBehavior(validationState, store.getEventStream(validationEvent), {
      model: null,
      valid: false,
      validationResults: {},
    });

    // Setup error state:
    store.addState(errorState, []);
    store.addReducer(errorState, addErrorEvent, (state, error) => [...state, error]);
    store.addReducer(errorState, clearErrorsEvent, () => []);

    // Setup stateless/lazy behaviors (dervived state):
    store.addLazyBehavior(
      isValidationPending,
      combineLatest(store.getBehavior(validationState), store.getBehavior(editModelState)).pipe(
        map(([validation, model]) => validation.model !== model.model),
      ),
    );
    store.addLazyBehavior(
      isSavePending,
      store.getBehavior(saveRequestState).pipe(map(state => state !== null)),
    );
    store.addLazyBehavior(
      isSaveDisabled,
      combineLatest(
        store.getBehavior(isValidationPending),
        store.getBehavior(isSavePending),
        store.getBehavior(validationState),
      ).pipe(map(([validating, saving, validation]) => validating || saving || !validation.valid)),
    );

    // Setup edit model effect:
    const getEntityMock = (id: number): Observable<Entity> => {
      if (id === 42) {
        throw new Error('ID 42 not found');
      }
      return of({
        id,
        stringField: 'someString',
        numberField: 42,
      }).pipe(delay(10));
    };
    store.add2TypedEventSource(
      editModelEffect,
      editModelEvent,
      addErrorEvent,
      store.getEventStream(startEditEvent).pipe(
        switchMap(id => {
          if (id === null) {
            return of({
              type: editModelEvent,
              event: getNewEntity(),
            });
          }
          return getEntityMock(id).pipe(
            map(entity => ({
              type: editModelEvent,
              event: entity,
            })),
            catchError(error =>
              of({
                type: addErrorEvent,
                event: String(error),
              }),
            ),
          );
        }),
      ),
      editModelEvent, // the event source  should only be subscribed, if editModelEvent is subscribed
    );

    // Setup validation effect (we could also filter to perform validation only, if showEditModal is true):
    const validatorMock = (entity: Entity): Observable<{ [key: string]: ValidationResult }> => {
      if (entity.stringField === 'THROW_ON_VALIDATE') {
        throw new Error('404 not found');
      }
      const result: { [key: string]: ValidationResult } = {};
      if (entity.numberField && entity.numberField < 0) {
        result.numberField = {
          validatedValue: entity.numberField,
          error: 'value must not be negative',
        };
      }
      if ((entity.stringField ?? '').trim() === '') {
        result.stringField = {
          validatedValue: entity.stringField,
          error: 'value is mandatory',
        };
      }
      return of(result).pipe(delay(10));
    };
    store.add2TypedEventSource(
      validationEffect,
      validationEvent,
      addErrorEvent,
      store.getBehavior(editModelState).pipe(
        switchMap(editModel =>
          validatorMock(editModel.model).pipe(
            map(validationResults => ({
              type: validationEvent,
              event: {
                model: editModel.model,
                valid: Object.keys(validationResults).length === 0,
                validationResults,
              },
            })),
            catchError(error =>
              of(
                {
                  type: addErrorEvent,
                  event: String(error),
                },
                {
                  type: validationEvent,
                  event: {
                    model: editModel.model,
                    valid: false,
                    validationResults: {},
                  },
                },
              ),
            ),
          ),
        ),
      ),
      validationEvent, // the event source  should only be subscribed, if validationEvent is subscribed
    );

    // Setup save effect:
    const saveMock = (entity: Entity | null): Observable<number> => {
      if (entity?.stringField === 'THROW_ON_SAVE') {
        throw new Error('400 bad request');
      }
      return entity === null ? NEVER : of(entity.id ?? 42).pipe(delay(10));
    };
    store.add2TypedEventSource(
      saveEffect,
      savedEvent,
      addErrorEvent,
      combineLatest([
        store.getBehavior(saveRequestState).pipe(filter(request => request !== null)),
        combineLatest([
          store.getBehavior(validationState),
          store.getBehavior(isValidationPending),
        ]).pipe(
          filter(([validation, pending]) => !pending && validation.valid),
          map(([validation]) => validation.model),
          distinctUntilChanged(),
        ),
      ]).pipe(
        filter(([request, validatedModel]) => request === validatedModel),
        switchMap(([requestModel]) =>
          saveMock(requestModel).pipe(
            map(id => ({
              type: savedEvent,
              event: {
                id,
                success: true,
                requestModel,
              },
            })),
            catchError(error =>
              of(
                {
                  type: addErrorEvent,
                  event: String(error),
                },
                {
                  type: savedEvent,
                  event: {
                    id: requestModel?.id,
                    success: false,
                    requestModel,
                  },
                },
              ),
            ),
          ),
        ),
      ),
      savedEvent, // the event source  should only be subscribed, if savedEvent is subscribed
    );
  });

  it('should subscribe saveDisabled and savePending lazily', () => {
    expect(store.isSubscribed(showEditModalState)).toBe(true);
    expect(store.isSubscribed(editModelState)).toBe(true);
    expect(store.isSubscribed(validationState)).toBe(true);
    expect(store.isSubscribed(saveRequestState)).toBe(true);
    expect(store.isSubscribed(errorState)).toBe(true);
    expect(store.isSubscribed(isSaveDisabled)).toBe(false);
    expect(store.isSubscribed(isSavePending)).toBe(false);
    expect(store.isSubscribed(isValidationPending)).toBe(true);
  });

  it('should have the correct initial state and start validation', async () => {
    await expectSequence(testObservable, [
      {
        showEditModalState: false,
        editModelState: { model: getNewEntity() },
        validationState: {
          model: null,
          valid: false,
          validationResults: {},
        },
        saveRequestState: null,
        errorState: [],
        isSaveDisabled: true,
        isSavePending: false,
        isValidationPending: true,
      },
      {
        showEditModalState: false,
        editModelState: { model: getNewEntity() },
        validationState: {
          model: null,
          valid: false,
          validationResults: {},
        },
        saveRequestState: null,
        errorState: [],
        isSaveDisabled: true,
        isSavePending: false,
        isValidationPending: false,
      },
      {
        showEditModalState: false,
        editModelState: { model: getNewEntity() },
        validationState: {
          model: getNewEntity(),
          valid: false,
          validationResults: {
            stringField: {
              validatedValue: null,
              error: 'value is mandatory',
            },
          },
        },
        saveRequestState: null,
        errorState: [],
        isSaveDisabled: true,
        isSavePending: false,
        isValidationPending: false,
      },
    ]);
  });
});
