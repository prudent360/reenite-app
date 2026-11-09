<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\FieldType;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class MetaController extends Controller
{
    public function staffRoles(): JsonResponse
    {
        return response()->json([
            'data' => array_map(fn (Role $role) => [
                'name' => $role->value,
                'label' => $role->label(),
            ], Role::staffRoles()),
        ]);
    }

    public function fieldTypes(): JsonResponse
    {
        return response()->json([
            'data' => array_map(fn (FieldType $type) => [
                'name' => $type->value,
                'label' => $type->label(),
                'needs_options' => $type->needsOptions(),
            ], FieldType::cases()),
        ]);
    }
}
