<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SyncServiceFieldsRequest;
use App\Http\Requests\Admin\SyncServiceRequirementsRequest;
use App\Http\Requests\Admin\SyncServiceStagesRequest;
use App\Http\Resources\ServiceResource;
use App\Models\Service;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

/**
 * Saves the intake form, required documents and stages of a service, each as a whole list.
 */
class ServiceBuilderController extends Controller
{
    public function fields(SyncServiceFieldsRequest $request, Service $service): ServiceResource
    {
        $this->sync($service->formFields(), $request->validated('fields'), fn (array $field) => [
            'key' => $field['key'],
            'label' => $field['label'],
            'type' => $field['type'],
            'options' => array_values(array_filter($field['options'] ?? [])) ?: null,
            'placeholder' => $field['placeholder'] ?? null,
            'help_text' => $field['help_text'] ?? null,
            'is_required' => $field['is_required'] ?? false,
        ]);

        return $this->respond($service);
    }

    public function requirements(SyncServiceRequirementsRequest $request, Service $service): ServiceResource
    {
        $this->sync($service->documentRequirements(), $request->validated('requirements'), fn (array $requirement) => [
            'label' => $requirement['label'],
            'description' => $requirement['description'] ?? null,
            'is_required' => $requirement['is_required'] ?? true,
        ]);

        return $this->respond($service);
    }

    public function stages(SyncServiceStagesRequest $request, Service $service): ServiceResource
    {
        $this->sync($service->stages(), $request->validated('stages'), fn (array $stage) => [
            'name' => $stage['name'],
            'description' => $stage['description'] ?? null,
            'customer_visible' => $stage['customer_visible'] ?? true,
        ]);

        return $this->respond($service);
    }

    /**
     * Updates rows whose id belongs to this service, creates the rest, deletes rows left out,
     * and stores the list order. Ids from another service are treated as new rows.
     * Field keys are freed before re-saving so items can swap keys without hitting the unique index.
     *
     * @param  HasMany<Model, Service>  $relation
     * @param  list<array<string, mixed>>  $items
     * @param  callable(array<string, mixed>): array<string, mixed>  $attributes
     */
    private function sync(HasMany $relation, array $items, callable $attributes): void
    {
        // validated() rebuilds the list rule by rule, so rows without an id can come out of
        // insertion order (e.g. [1 => ..., 0 => ...]). The numeric keys are the true positions.
        ksort($items);

        DB::transaction(function () use ($relation, $items, $attributes) {
            $existing = $relation->getQuery()->get()->keyBy('id');
            $keptIds = collect($items)->pluck('id')->filter(fn ($id) => $id && $existing->has($id))->all();

            $relation->getQuery()->whereKeyNot($keptIds)->delete();

            if ($relation->getRelated()->isFillable('key')) {
                foreach ($keptIds as $id) {
                    $existing[$id]->forceFill(['key' => "__tmp_{$id}"])->saveQuietly();
                }
            }

            foreach (array_values($items) as $position => $item) {
                $values = $attributes($item) + ['sort_order' => $position];
                $id = $item['id'] ?? null;

                if ($id && $existing->has($id)) {
                    $existing[$id]->fill($values)->save();
                } else {
                    $relation->create($values);
                }
            }
        });
    }

    private function respond(Service $service): ServiceResource
    {
        return (new ServiceResource($service->load(['category', 'formFields', 'documentRequirements', 'stages'])))->forStaff();
    }
}
