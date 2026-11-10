<?php

namespace App\Http\Controllers\Api\V1\Admin\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Workspace\SpaceRequest;
use App\Http\Resources\SpaceResource;
use App\Models\Space;
use App\Support\Slug;
use App\Uploads\UploadLimit;
use App\Workspace\OpeningHours;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class SpaceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['location_id' => ['nullable', 'integer'], 'space_type_id' => ['nullable', 'integer']]);

        $spaces = Space::query()
            ->with(['location', 'type', 'rates'])
            ->when($request->filled('location_id'), fn ($query) => $query->where('location_id', $request->integer('location_id')))
            ->when($request->filled('space_type_id'), fn ($query) => $query->where('space_type_id', $request->integer('space_type_id')))
            ->orderBy('location_id')
            ->ordered()
            ->get();

        return SpaceResource::collection($spaces);
    }

    public function store(SpaceRequest $request): JsonResponse
    {
        $space = $this->save(new Space, $request);

        return (new SpaceResource($this->loadForEditor($space)))->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Space $space): SpaceResource
    {
        return new SpaceResource($this->loadForEditor($space));
    }

    public function update(SpaceRequest $request, Space $space): SpaceResource
    {
        return new SpaceResource($this->loadForEditor($this->save($space, $request)));
    }

    /**
     * Bookings (Milestone 6) will block this; until then spaces can be removed outright.
     */
    public function destroy(Space $space): Response
    {
        if ($space->photo_path) {
            Storage::disk('public')->delete($space->photo_path);
        }
        $space->delete();

        return response()->noContent();
    }

    public function photo(Request $request, Space $space): SpaceResource
    {
        $request->validate(
            ['photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', UploadLimit::rule(), 'dimensions:min_width=600,min_height=400']],
            ['photo.max' => UploadLimit::message('The photo')],
        );

        $old = $space->photo_path;
        $space->forceFill(['photo_path' => $request->file('photo')->store('spaces', 'public')])->save();
        if ($old) {
            Storage::disk('public')->delete($old);
        }

        return new SpaceResource($this->loadForEditor($space));
    }

    public function removePhoto(Space $space): SpaceResource
    {
        if ($space->photo_path) {
            Storage::disk('public')->delete($space->photo_path);
            $space->forceFill(['photo_path' => null])->save();
        }

        return new SpaceResource($this->loadForEditor($space));
    }

    /**
     * Saves the space with its rates (replaced as a set) and add-ons.
     */
    private function save(Space $space, SpaceRequest $request): Space
    {
        $data = $request->validated();
        $attributes = Arr::except($data, ['rates', 'addon_ids']);
        $attributes['slug'] = Slug::unique(Space::class, $data['slug'] ?? $data['name'], $space->id);
        $attributes['hours'] = OpeningHours::normalise($data['hours'] ?? null);
        $attributes['amenities'] = array_values(array_filter($data['amenities'] ?? []));

        return DB::transaction(function () use ($space, $attributes, $data) {
            $space->fill($attributes)->save();

            $units = collect($data['rates'])->pluck('unit');
            $space->rates()->whereNotIn('unit', $units)->delete();
            foreach ($data['rates'] as $rate) {
                $space->rates()->updateOrCreate(['unit' => $rate['unit']], ['price' => $rate['price'], 'is_active' => $rate['is_active'] ?? true]);
            }

            $space->addons()->sync($data['addon_ids'] ?? []);

            return $space;
        });
    }

    private function loadForEditor(Space $space): Space
    {
        return $space->load(['location', 'type', 'cancellationPolicy', 'rates', 'addons']);
    }
}
