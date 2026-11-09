@props(['url'])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block;">
<img src="{{ rtrim(config('app.frontend_url'), '/') }}/brand/reenite-logo-full.png" alt="{{ config('app.name') }}" height="36" style="height: 36px; width: auto; max-width: 160px; border: 0;">
</a>
</td>
</tr>
